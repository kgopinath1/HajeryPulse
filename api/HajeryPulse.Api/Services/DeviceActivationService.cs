using System.Data;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using HajeryPulse.Api.Data;
using Microsoft.Extensions.Caching.Memory;

namespace HajeryPulse.Api.Services;

public enum DeviceKeyStatus { Active, NotActivated, Revoked }

public enum ActivationOutcome { Activated, CodeInvalid, CodeExpired, CodeUsed, TooManyAttempts }

public sealed record ActivationResult(ActivationOutcome Outcome, string? DeviceKey = null, int AttemptsLeft = 0);

public interface IDeviceActivationService
{
    /// <summary>Checks the device key the app sent against the signed-in user.</summary>
    Task<DeviceKeyStatus> CheckAsync(Guid userObjectId, string? deviceKey);

    /// <summary>
    /// Redeems the user's activation code (from IT) for a new device key.
    /// On success the user's previously activated device is revoked.
    /// </summary>
    Task<ActivationResult> ActivateAsync(Guid userObjectId, string code, string? platform, string? deviceName);
}

/// <summary>
/// One activated device per user, replacing the old self-reported device ID
/// allowlist. IT generates a short single-use code for a user
/// (database/03_procedures/sp_device_activation.sql); the app exchanges it
/// once for a 256-bit random device key, kept in the phone's secure storage
/// and sent as X-Device-Key on every request.
///
/// Unlike the old device ID, the key is a secret bound to one user: it can't
/// be read off the phone's settings, and another user's token won't pass
/// with it. Only SHA-256 hashes of codes and keys are stored.
/// </summary>
public sealed class DeviceActivationService : IDeviceActivationService
{
    public const int MaxFailedAttempts = 5;

    private readonly IDbConnectionFactory _factory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<DeviceActivationService> _logger;
    private readonly TimeSpan _cacheFor;

    public DeviceActivationService(IDbConnectionFactory factory, IMemoryCache cache,
        IConfiguration config, ILogger<DeviceActivationService> logger)
    {
        _factory = factory;
        _cache = cache;
        _logger = logger;
        // Every API call is checked, so results are cached briefly. A device
        // IT revokes is locked out within this window.
        _cacheFor = TimeSpan.FromSeconds(config.GetValue("DeviceActivation:CheckCacheSeconds", 60));
    }

    public async Task<DeviceKeyStatus> CheckAsync(Guid userObjectId, string? deviceKey)
    {
        if (string.IsNullOrWhiteSpace(deviceKey)) return DeviceKeyStatus.NotActivated;

        var keyHash = Hash(deviceKey.Trim());
        var cacheKey = $"device-key:{userObjectId:N}:{Convert.ToHexString(keyHash)}";
        if (_cacheFor > TimeSpan.Zero && _cache.TryGetValue(cacheKey, out DeviceKeyStatus cached)) return cached;

        using var c = await _factory.OpenAsync();
        var device = await c.QueryFirstOrDefaultAsync<(int UserDeviceId, Guid UserObjectId, DateTime? RevokedUtc)>(
            "SELECT UserDeviceId, UserObjectId, RevokedUtc FROM app.UserDevice WHERE KeyHash = @KeyHash;",
            new { KeyHash = keyHash });

        DeviceKeyStatus status;
        if (device.UserDeviceId == 0 || device.UserObjectId != userObjectId)
        {
            status = DeviceKeyStatus.NotActivated;
        }
        else if (device.RevokedUtc is not null)
        {
            status = DeviceKeyStatus.Revoked;
        }
        else
        {
            status = DeviceKeyStatus.Active;
            await c.ExecuteAsync(
                "UPDATE app.UserDevice SET LastSeenUtc = SYSUTCDATETIME() WHERE UserDeviceId = @Id;",
                new { Id = device.UserDeviceId });
        }

        if (_cacheFor > TimeSpan.Zero) _cache.Set(cacheKey, status, _cacheFor);
        return status;
    }

    public async Task<ActivationResult> ActivateAsync(Guid userObjectId, string code, string? platform, string? deviceName)
    {
        var codeHash = Hash(NormalizeCode(code));

        using var c = await _factory.OpenAsync();
        using var tx = c.BeginTransaction(IsolationLevel.Serializable);

        // Only the user's latest code counts: generating a new one cancels
        // the old. UPDLOCK serialises two phones redeeming at the same time.
        var latest = await c.QueryFirstOrDefaultAsync<(int CodeId, byte[] CodeHash, DateTime ExpiresUtc, int FailedAttempts, DateTime? RedeemedUtc)>(@"
SELECT TOP 1 CodeId, CodeHash, ExpiresUtc, FailedAttempts, RedeemedUtc
FROM app.DeviceActivationCode WITH (UPDLOCK, HOLDLOCK)
WHERE UserObjectId = @UserObjectId AND CancelledUtc IS NULL
ORDER BY CreatedUtc DESC, CodeId DESC;", new { UserObjectId = userObjectId }, tx);

        if (latest.CodeId == 0)
        {
            tx.Commit();
            return Fail(ActivationOutcome.CodeInvalid, "no code issued");
        }

        var matches = CryptographicOperations.FixedTimeEquals(latest.CodeHash, codeHash);

        if (latest.RedeemedUtc is not null)
        {
            tx.Commit();
            return Fail(matches ? ActivationOutcome.CodeUsed : ActivationOutcome.CodeInvalid, "latest code already used");
        }

        if (latest.FailedAttempts >= MaxFailedAttempts)
        {
            tx.Commit();
            return Fail(ActivationOutcome.TooManyAttempts, "code locked");
        }

        if (!matches)
        {
            var failed = latest.FailedAttempts + 1;
            await c.ExecuteAsync("UPDATE app.DeviceActivationCode SET FailedAttempts = @Failed WHERE CodeId = @CodeId;",
                new { Failed = failed, latest.CodeId }, tx);
            tx.Commit();
            return failed >= MaxFailedAttempts
                ? Fail(ActivationOutcome.TooManyAttempts, "wrong code, now locked")
                : Fail(ActivationOutcome.CodeInvalid, "wrong code", MaxFailedAttempts - failed);
        }

        if (latest.ExpiresUtc < DateTime.UtcNow)
        {
            tx.Commit();
            return Fail(ActivationOutcome.CodeExpired, "code expired");
        }

        var deviceKey = Base64Url(RandomNumberGenerator.GetBytes(32));
        var deviceId = await c.ExecuteScalarAsync<int>(@"
UPDATE app.UserDevice
   SET RevokedUtc = SYSUTCDATETIME(), RevokedReason = N'Replaced by a newly activated device'
 WHERE UserObjectId = @UserObjectId AND RevokedUtc IS NULL;

INSERT INTO app.UserDevice (UserObjectId, KeyHash, Platform, DeviceName)
VALUES (@UserObjectId, @KeyHash, @Platform, @DeviceName);
DECLARE @DeviceId INT = CAST(SCOPE_IDENTITY() AS INT);

UPDATE app.DeviceActivationCode
   SET RedeemedUtc = SYSUTCDATETIME(), RedeemedUserDeviceId = @DeviceId
 WHERE CodeId = @CodeId;

SELECT @DeviceId;", new
        {
            UserObjectId = userObjectId,
            KeyHash = Hash(deviceKey),
            Platform = Truncate(platform, 20),
            DeviceName = Truncate(deviceName, 200),
            latest.CodeId,
        }, tx);
        tx.Commit();

        _logger.LogInformation("Device {UserDeviceId} activated for user {UserObjectId} ({Platform}, {DeviceName})",
            deviceId, userObjectId, platform, deviceName);
        return new ActivationResult(ActivationOutcome.Activated, deviceKey);

        ActivationResult Fail(ActivationOutcome outcome, string detail, int attemptsLeft = 0)
        {
            _logger.LogWarning("Device activation failed for user {UserObjectId}: {Detail}", userObjectId, detail);
            return new ActivationResult(outcome, AttemptsLeft: attemptsLeft);
        }
    }

    /// <summary>"k7qm 4xpd" / "K7QM-4XPD" → "K7QM4XPD", matching how the SQL procedure hashes it.</summary>
    internal static string NormalizeCode(string code) =>
        new((code ?? "").ToUpperInvariant().Where(ch => ch is >= 'A' and <= 'Z' or >= '0' and <= '9').ToArray());

    // HASHBYTES('SHA2_256', <varchar>) hashes the ASCII bytes, so hash the same here.
    internal static byte[] Hash(string value) => SHA256.HashData(Encoding.ASCII.GetBytes(value));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string? Truncate(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().Length > max ? value.Trim()[..max] : value.Trim();
}
