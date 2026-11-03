using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dapper;
using HajeryPulse.Api.Data;
using Microsoft.Extensions.Caching.Memory;

namespace HajeryPulse.Api.Services;

/// <summary>Where the signed-in user and this device stand.</summary>
public enum DeviceState
{
    /// <summary>User is active and this device's token is valid.</summary>
    Active,
    /// <summary>Email not in dim.[User], or IsActive = 0.</summary>
    UserNotAllowed,
    /// <summary>No request for this device yet (new user, new phone, or factory reset).</summary>
    NotRegistered,
    /// <summary>"Get token" tapped, waiting for IT.</summary>
    Requested,
    /// <summary>IT issued a token, waiting for the user to enter it.</summary>
    Issued,
    /// <summary>Device is active for this user, but the app sent no (or a wrong) token — e.g. after an Android reinstall.</summary>
    TokenMissing,
    /// <summary>Turned off by IT.</summary>
    Revoked,
}

public sealed record DeviceCheck(DeviceState State, int ActiveDevices = 0);

public enum TokenRequestOutcome { Notified, AlreadyNotified, NotifyFailed, InvalidDeviceId }

public enum ActivationOutcome { Activated, NotIssued, TokenInvalid, TokenExpired, TooManyAttempts, DeviceLimit }

public sealed record ActivationResult(ActivationOutcome Outcome, int AttemptsLeft = 0);

public interface IDeviceTokenService
{
    /// <summary>Checks the user (by email) and the device ID + token the app sent.</summary>
    Task<DeviceCheck> CheckAsync(string? email, string? deviceId, string? token);

    /// <summary>"Get token": records a request for this device and emails IT.</summary>
    Task<TokenRequestOutcome> RequestTokenAsync(string email, string? deviceId, string? platform, string? deviceName);

    /// <summary>Checks the token IT issued for this device and activates it.</summary>
    Task<ActivationResult> ActivateAsync(string email, string? deviceId, string token);
}

/// <summary>
/// Device tokens (see database/01_schema/006_device_activation.sql). Access
/// needs both: the user's email active in dim.[User], and this device's
/// token, issued by IT for a "Get token" request, which the app sends as
/// X-Device-Token with its X-Device-Id on every request.
///
/// The device ID is the phone's own (iOS identifierForVendor, Android
/// ANDROID_ID), so a reinstall keeps the same row: the same token works
/// again. It only labels the device — the token is the secret, and is
/// random, never derived from the device ID. A user can have up to
/// DeviceTokens:MaxActiveDevices active devices. Only SHA-256 hashes of
/// tokens are stored.
/// </summary>
public sealed class DeviceTokenService : IDeviceTokenService
{
    public const int MaxFailedAttempts = 5;

    // A UUID (iOS) or 16 hex digits (Android), with some leeway.
    private static readonly Regex DeviceIdFormat = new("^[A-Z0-9-]{8,64}$", RegexOptions.Compiled);

    private readonly IDbConnectionFactory _factory;
    private readonly IMemoryCache _cache;
    private readonly IDeviceRequestNotifier _notifier;
    private readonly ILogger<DeviceTokenService> _logger;
    private readonly TimeSpan _cacheFor;
    private readonly TimeSpan _notifyCooldown;
    private readonly int _maxActiveDevices;

    public DeviceTokenService(IDbConnectionFactory factory, IMemoryCache cache, IDeviceRequestNotifier notifier,
        IConfiguration config, ILogger<DeviceTokenService> logger)
    {
        _factory = factory;
        _cache = cache;
        _notifier = notifier;
        _logger = logger;
        // Every API call is checked, so results are cached briefly. A user or
        // device IT turns off is locked out within this window.
        _cacheFor = TimeSpan.FromSeconds(config.GetValue("DeviceTokens:CheckCacheSeconds", 60));
        // Tapping "Get token" again within this window doesn't email IT again.
        _notifyCooldown = TimeSpan.FromMinutes(config.GetValue("DeviceTokens:RequestCooldownMinutes", 15));
        _maxActiveDevices = config.GetValue("DeviceTokens:MaxActiveDevices", 2);
    }

    private sealed class CheckRow
    {
        public bool? IsActive { get; set; }
        public int? DeviceTokenId { get; set; }
        public string? Status { get; set; }
        public byte[]? TokenHash { get; set; }
        public int ActiveDevices { get; set; }
    }

    public async Task<DeviceCheck> CheckAsync(string? email, string? deviceId, string? token)
    {
        if (email is null) return new DeviceCheck(DeviceState.UserNotAllowed);

        var device = NormalizeDeviceId(deviceId);
        var tokenHash = string.IsNullOrWhiteSpace(token) ? null : Hash(NormalizeToken(token));
        var cacheKey = $"device:{email}:{device ?? "-"}:{(tokenHash is null ? "-" : Convert.ToHexString(tokenHash))}";
        if (_cacheFor > TimeSpan.Zero && _cache.TryGetValue(cacheKey, out DeviceCheck? cached)) return cached!;

        using var c = await _factory.OpenAsync();
        var row = await c.QuerySingleAsync<CheckRow>(@"
SELECT u.IsActive, t.DeviceTokenId, t.Status, t.TokenHash,
       ActiveDevices = (SELECT COUNT(*) FROM app.DeviceToken a WHERE a.UserEmail = @Email AND a.Status = 'Active')
  FROM (SELECT 1 AS One) x
  LEFT JOIN dim.[User] u ON u.Email = @Email
 OUTER APPLY (SELECT TOP 1 DeviceTokenId, Status, TokenHash
                FROM app.DeviceToken
               WHERE UserEmail = @Email AND DeviceId = @DeviceId
               ORDER BY DeviceTokenId DESC) t;", new { Email = email, DeviceId = device ?? "" });

        DeviceState state;
        if (row.IsActive != true) state = DeviceState.UserNotAllowed;
        else if (row.DeviceTokenId is null) state = DeviceState.NotRegistered;
        else state = row.Status switch
        {
            "Active" => tokenHash is not null && row.TokenHash is not null && CryptographicOperations.FixedTimeEquals(row.TokenHash, tokenHash)
                ? DeviceState.Active
                : DeviceState.TokenMissing,
            "Requested" => DeviceState.Requested,
            "Issued" => DeviceState.Issued,
            _ => DeviceState.Revoked,
        };

        if (state == DeviceState.Active)
        {
            await c.ExecuteAsync(@"
UPDATE app.DeviceToken SET LastSeenUtc = SYSUTCDATETIME() WHERE DeviceTokenId = @Id;
UPDATE dim.[User] SET LastLoginAt = SYSUTCDATETIME() WHERE Email = @Email;", new { Id = row.DeviceTokenId, Email = email });
        }

        var result = new DeviceCheck(state, row.ActiveDevices);
        if (_cacheFor > TimeSpan.Zero) _cache.Set(cacheKey, result, _cacheFor);
        return result;
    }

    private sealed class RequestRow
    {
        public int DeviceTokenId { get; set; }
        public string Status { get; set; } = "";
        public int FailedAttempts { get; set; }
        public DateTime? TokenExpiresUtc { get; set; }
        public DateTime? NotifiedUtc { get; set; }
    }

    public async Task<TokenRequestOutcome> RequestTokenAsync(string email, string? deviceId, string? platform, string? deviceName)
    {
        var device = NormalizeDeviceId(deviceId);
        if (device is null) return TokenRequestOutcome.InvalidDeviceId;

        DeviceTokenRequest request;
        List<string> recipients;
        bool notify;

        using (var c = await _factory.OpenAsync())
        using (var tx = c.BeginTransaction(IsolationLevel.Serializable))
        {
            // The user's current row for this device, if any. A device IT
            // turned off (Inactive) gets a fresh row.
            var current = await c.QueryFirstOrDefaultAsync<RequestRow>(@"
SELECT TOP 1 DeviceTokenId, Status, FailedAttempts, TokenExpiresUtc, NotifiedUtc
  FROM app.DeviceToken WITH (UPDLOCK, HOLDLOCK)
 WHERE UserEmail = @Email AND DeviceId = @DeviceId AND Status <> 'Inactive'
 ORDER BY DeviceTokenId DESC;", new { Email = email, DeviceId = device }, tx);

            int id;
            if (current is null)
            {
                id = await c.ExecuteScalarAsync<int>(@"
INSERT INTO app.DeviceToken (UserEmail, DeviceId, Platform, DeviceName, Status)
VALUES (@Email, @DeviceId, @Platform, @DeviceName, 'Requested');
SELECT CAST(SCOPE_IDENTITY() AS INT);", new
                {
                    Email = email,
                    DeviceId = device,
                    Platform = Truncate(platform, 20),
                    DeviceName = Truncate(deviceName, 200),
                }, tx);
                notify = true;
            }
            else
            {
                id = current.DeviceTokenId;
                // Back to waiting for IT when the token can't be used any
                // more: expired or locked, or the device is active but the
                // user no longer has its token (lost it after an Android
                // reinstall). That also ends the old token.
                var reopen = current.Status == "Active" ||
                    (current.Status == "Issued" &&
                     (current.FailedAttempts >= MaxFailedAttempts || current.TokenExpiresUtc < DateTime.UtcNow));
                if (reopen)
                {
                    await c.ExecuteAsync(@"
UPDATE app.DeviceToken
   SET Status = 'Requested', TokenHash = NULL, FailedAttempts = 0, IssuedUtc = NULL, IssuedBy = NULL,
       TokenExpiresUtc = NULL, RequestedUtc = SYSUTCDATETIME(),
       Platform = COALESCE(@Platform, Platform), DeviceName = COALESCE(@DeviceName, DeviceName)
 WHERE DeviceTokenId = @Id;", new { Id = id, Platform = Truncate(platform, 20), DeviceName = Truncate(deviceName, 200) }, tx);
                }
                notify = reopen || current.NotifiedUtc is null || current.NotifiedUtc < DateTime.UtcNow - _notifyCooldown;
            }

            request = await c.QuerySingleAsync<DeviceTokenRequest>(@"
SELECT RequestId = t.DeviceTokenId, Email = t.UserEmail, u.DisplayName, t.Platform, t.DeviceName, t.DeviceId, t.RequestedUtc,
       ActiveDevices = (SELECT COUNT(*) FROM app.DeviceToken a WHERE a.UserEmail = t.UserEmail AND a.Status = 'Active')
  FROM app.DeviceToken t
  LEFT JOIN dim.[User] u ON u.Email = t.UserEmail
 WHERE t.DeviceTokenId = @Id;", new { Id = id }, tx);

            // Read on every request, so IT can change who's emailed from SSMS
            // without redeploying (app.usp_Device_SetRecipient).
            recipients = (await c.QueryAsync<string>(
                "SELECT Email FROM app.DeviceTokenRecipient WHERE IsActive = 1 ORDER BY Email;", transaction: tx)).ToList();
            tx.Commit();
        }

        _logger.LogInformation("Device token request {RequestId} from {Email} ({Platform}, {DeviceName})",
            request.RequestId, email, request.Platform, request.DeviceName);

        if (!notify) return TokenRequestOutcome.AlreadyNotified;

        // Outside the transaction: the request is saved even if the email
        // fails, and IT can still find it with app.usp_Device_Requests.
        if (!await _notifier.NotifyAsync(request, recipients)) return TokenRequestOutcome.NotifyFailed;

        using (var c = await _factory.OpenAsync())
            await c.ExecuteAsync("UPDATE app.DeviceToken SET NotifiedUtc = SYSUTCDATETIME() WHERE DeviceTokenId = @Id;",
                new { Id = request.RequestId });
        return TokenRequestOutcome.Notified;
    }

    private sealed class ActivateRow
    {
        public int DeviceTokenId { get; set; }
        public string Status { get; set; } = "";
        public byte[]? TokenHash { get; set; }
        public DateTime? TokenExpiresUtc { get; set; }
        public int FailedAttempts { get; set; }
    }

    public async Task<ActivationResult> ActivateAsync(string email, string? deviceId, string token)
    {
        var device = NormalizeDeviceId(deviceId);
        if (device is null) return Fail(ActivationOutcome.NotIssued, "no device ID");
        var tokenHash = Hash(NormalizeToken(token));

        using var c = await _factory.OpenAsync();
        using var tx = c.BeginTransaction(IsolationLevel.Serializable);

        var row = await c.QueryFirstOrDefaultAsync<ActivateRow>(@"
SELECT TOP 1 DeviceTokenId, Status, TokenHash, TokenExpiresUtc, FailedAttempts
  FROM app.DeviceToken WITH (UPDLOCK, HOLDLOCK)
 WHERE UserEmail = @Email AND DeviceId = @DeviceId AND Status <> 'Inactive'
 ORDER BY DeviceTokenId DESC;", new { Email = email, DeviceId = device }, tx);

        // An already active device: this is the user re-entering their token
        // after a reinstall (or a retry after a dropped connection). Wrong
        // guesses count towards the lockout here too.
        if (row?.Status == "Active")
        {
            if (row.FailedAttempts >= MaxFailedAttempts)
            {
                tx.Commit();
                return Fail(ActivationOutcome.TooManyAttempts, "active device locked");
            }
            if (row.TokenHash is not null && CryptographicOperations.FixedTimeEquals(row.TokenHash, tokenHash))
            {
                await c.ExecuteAsync("UPDATE app.DeviceToken SET FailedAttempts = 0, LastSeenUtc = SYSUTCDATETIME() WHERE DeviceTokenId = @Id;",
                    new { Id = row.DeviceTokenId }, tx);
                tx.Commit();
                return new ActivationResult(ActivationOutcome.Activated);
            }
            return await WrongToken(row);
        }
        if (row is null || row.Status != "Issued")
        {
            tx.Commit();
            return Fail(ActivationOutcome.NotIssued, $"no token issued (status {row?.Status ?? "none"})");
        }
        if (row.FailedAttempts >= MaxFailedAttempts)
        {
            tx.Commit();
            return Fail(ActivationOutcome.TooManyAttempts, "token locked");
        }
        if (row.TokenHash is null || !CryptographicOperations.FixedTimeEquals(row.TokenHash, tokenHash))
        {
            return await WrongToken(row);
        }
        if (row.TokenExpiresUtc < DateTime.UtcNow)
        {
            tx.Commit();
            return Fail(ActivationOutcome.TokenExpired, "token expired");
        }

        var activeDevices = await c.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM app.DeviceToken WITH (UPDLOCK, HOLDLOCK) WHERE UserEmail = @Email AND Status = 'Active';",
            new { Email = email }, tx);
        if (activeDevices >= _maxActiveDevices)
        {
            tx.Commit();
            return Fail(ActivationOutcome.DeviceLimit, $"already {activeDevices} active devices");
        }

        await c.ExecuteAsync(@"
UPDATE app.DeviceToken
   SET Status = 'Active', ActivatedUtc = SYSUTCDATETIME(), LastSeenUtc = SYSUTCDATETIME(), FailedAttempts = 0
 WHERE DeviceTokenId = @Id;

UPDATE dim.[User] SET LastLoginAt = SYSUTCDATETIME() WHERE Email = @Email;",
            new { Id = row.DeviceTokenId, Email = email }, tx);
        tx.Commit();

        _logger.LogInformation("Device {DeviceTokenId} activated for {Email}", row.DeviceTokenId, email);
        return new ActivationResult(ActivationOutcome.Activated);

        async Task<ActivationResult> WrongToken(ActivateRow r)
        {
            var failed = r.FailedAttempts + 1;
            await c.ExecuteAsync("UPDATE app.DeviceToken SET FailedAttempts = @Failed WHERE DeviceTokenId = @Id;",
                new { Failed = failed, Id = r.DeviceTokenId }, tx);
            tx.Commit();
            return failed >= MaxFailedAttempts
                ? Fail(ActivationOutcome.TooManyAttempts, "wrong token, now locked")
                : Fail(ActivationOutcome.TokenInvalid, "wrong token", MaxFailedAttempts - failed);
        }

        ActivationResult Fail(ActivationOutcome outcome, string detail, int attemptsLeft = 0)
        {
            _logger.LogWarning("Device activation failed for {Email}: {Detail}", email, detail);
            return new ActivationResult(outcome, attemptsLeft);
        }
    }

    /// <summary>The phone's ID, upper-cased; null if missing or not ID-shaped.</summary>
    internal static string? NormalizeDeviceId(string? deviceId)
    {
        var id = deviceId?.Trim().ToUpperInvariant();
        return id is not null && DeviceIdFormat.IsMatch(id) ? id : null;
    }

    /// <summary>"k7qm 4xpd" / "K7QM-4XPD" → "K7QM4XPD", matching how the SQL procedure hashes it.</summary>
    internal static string NormalizeToken(string token) =>
        new((token ?? "").ToUpperInvariant().Where(ch => ch is >= 'A' and <= 'Z' or >= '0' and <= '9').ToArray());

    // HASHBYTES('SHA2_256', <varchar>) hashes the ASCII bytes, so hash the same here.
    internal static byte[] Hash(string value) => SHA256.HashData(Encoding.ASCII.GetBytes(value));

    private static string? Truncate(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().Length > max ? value.Trim()[..max] : value.Trim();
}
