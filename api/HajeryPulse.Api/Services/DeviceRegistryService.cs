using Dapper;
using HajeryPulse.Api.Data;

namespace HajeryPulse.Api.Services;

public sealed class DeviceRecord
{
    public string DeviceId { get; set; } = "";
    public string? UserId { get; set; }
    public string? Platform { get; set; }
    public DateTime FirstSeenUtc { get; set; }
    public DateTime LastSeenUtc { get; set; }
    public bool IsApproved { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public bool IsBlacklisted { get; set; }
    public DateTime? BlacklistedAtUtc { get; set; }
    public string? BlacklistReason { get; set; }
}

public interface IDeviceRegistryService
{
    /// <summary>Records the device as seen and returns its current record (creating one, unapproved, if new).</summary>
    Task<DeviceRecord> TouchAsync(string deviceId, string? userId, string? platform);
    Task<IReadOnlyCollection<DeviceRecord>> ListAsync();
    Task<DeviceRecord> ApproveAsync(string deviceId);
    Task<DeviceRecord> BlacklistAsync(string deviceId, string? reason);
    Task<bool> UnblacklistAsync(string deviceId);
}

/// <summary>
/// SQL-backed device allowlist. Until real RBAC ships, this is the
/// compensating control: only devices an admin has explicitly approved may
/// use the API at all. A device seen for the first time is recorded (so an
/// admin can find its ID to approve it) but blocked until approved. Blacklist
/// sits on top as an explicit revocation, overriding approval either way.
///
/// This is still a soft control, not a hard security boundary: the device ID
/// is self-reported by the client via the X-Device-Id header. A determined
/// attacker with a stolen token could try to spoof it — real identity still
/// comes from token validation. This narrows who can use a valid token to
/// devices IT has already signed off on, compensating for RBAC not existing yet.
/// </summary>
public sealed class DeviceRegistryService : IDeviceRegistryService
{
    private readonly IDbConnectionFactory _factory;

    public DeviceRegistryService(IDbConnectionFactory factory) => _factory = factory;

    // Runs on every request that carries X-Device-Id. New devices are
    // recorded but NOT approved — approval is a separate, explicit admin
    // action (ApproveAsync). Seeing a device must never imply trusting it,
    // or the allowlist model is defeated. MERGE keeps the upsert atomic so
    // concurrent requests for the same device can't race each other.
    public async Task<DeviceRecord> TouchAsync(string deviceId, string? userId, string? platform)
    {
        using var c = await _factory.OpenAsync();
        const string sql = @"
MERGE dbo.Devices AS target
USING (SELECT @DeviceId AS DeviceId) AS src
ON target.DeviceId = src.DeviceId
WHEN MATCHED THEN
    UPDATE SET LastSeenUtc = @Now,
               UserId = COALESCE(@UserId, target.UserId),
               Platform = COALESCE(@Platform, target.Platform)
WHEN NOT MATCHED THEN
    INSERT (DeviceId, UserId, Platform, FirstSeenUtc, LastSeenUtc, IsApproved, IsBlacklisted)
    VALUES (@DeviceId, @UserId, @Platform, @Now, @Now, 0, 0)
OUTPUT inserted.*;";
        return await c.QueryFirstAsync<DeviceRecord>(sql,
            new { DeviceId = deviceId, UserId = userId, Platform = platform, Now = DateTime.UtcNow });
    }

    public async Task<DeviceRecord> ApproveAsync(string deviceId)
    {
        using var c = await _factory.OpenAsync();
        const string sql = @"
MERGE dbo.Devices AS target
USING (SELECT @DeviceId AS DeviceId) AS src
ON target.DeviceId = src.DeviceId
WHEN MATCHED THEN
    UPDATE SET IsApproved = 1, ApprovedAtUtc = @Now
WHEN NOT MATCHED THEN
    INSERT (DeviceId, FirstSeenUtc, LastSeenUtc, IsApproved, ApprovedAtUtc, IsBlacklisted)
    VALUES (@DeviceId, @Now, @Now, 1, @Now, 0)
OUTPUT inserted.*;";
        return await c.QueryFirstAsync<DeviceRecord>(sql, new { DeviceId = deviceId, Now = DateTime.UtcNow });
    }

    public async Task<IReadOnlyCollection<DeviceRecord>> ListAsync()
    {
        using var c = await _factory.OpenAsync();
        var rows = await c.QueryAsync<DeviceRecord>("SELECT * FROM dbo.Devices ORDER BY LastSeenUtc DESC");
        return rows.ToList();
    }

    public async Task<DeviceRecord> BlacklistAsync(string deviceId, string? reason)
    {
        using var c = await _factory.OpenAsync();
        const string sql = @"
MERGE dbo.Devices AS target
USING (SELECT @DeviceId AS DeviceId) AS src
ON target.DeviceId = src.DeviceId
WHEN MATCHED THEN
    UPDATE SET IsBlacklisted = 1, BlacklistedAtUtc = @Now, BlacklistReason = @Reason
WHEN NOT MATCHED THEN
    INSERT (DeviceId, FirstSeenUtc, LastSeenUtc, IsApproved, IsBlacklisted, BlacklistedAtUtc, BlacklistReason)
    VALUES (@DeviceId, @Now, @Now, 0, 1, @Now, @Reason)
OUTPUT inserted.*;";
        return await c.QueryFirstAsync<DeviceRecord>(sql, new { DeviceId = deviceId, Now = DateTime.UtcNow, Reason = reason });
    }

    public async Task<bool> UnblacklistAsync(string deviceId)
    {
        using var c = await _factory.OpenAsync();
        const string sql = @"
UPDATE dbo.Devices
SET IsBlacklisted = 0, BlacklistedAtUtc = NULL, BlacklistReason = NULL
WHERE DeviceId = @DeviceId;";
        var rows = await c.ExecuteAsync(sql, new { DeviceId = deviceId });
        return rows > 0;
    }
}
