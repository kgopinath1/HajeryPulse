using System.Text.Json;

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
/// Flat-file device allowlist, persisted as JSON. Until real RBAC ships, this is
/// the compensating control: only devices an admin has explicitly approved may
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
    private readonly string _filePath;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private Dictionary<string, DeviceRecord> _cache = new(StringComparer.OrdinalIgnoreCase);
    private bool _loaded;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    public DeviceRegistryService(IConfiguration config)
    {
        _filePath = config["DeviceControl:RegistryFilePath"] ?? "App_Data/devices.json";
    }

    private async Task EnsureLoadedAsync()
    {
        if (_loaded) return;
        await _lock.WaitAsync();
        try
        {
            if (_loaded) return;
            if (File.Exists(_filePath))
            {
                var json = await File.ReadAllTextAsync(_filePath);
                _cache = JsonSerializer.Deserialize<Dictionary<string, DeviceRecord>>(json, JsonOptions)
                         ?? new(StringComparer.OrdinalIgnoreCase);
            }
            _loaded = true;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task SaveAsync()
    {
        var dir = Path.GetDirectoryName(_filePath);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        var json = JsonSerializer.Serialize(_cache, JsonOptions);
        await File.WriteAllTextAsync(_filePath, json);
    }

    // Written on every request that carries X-Device-Id — fine for this app's
    // traffic volume; if that ever changes, batch/throttle the disk writes.
    // New devices are recorded but NOT approved — approval is a separate,
    // explicit admin action (ApproveAsync). Seeing a device must never imply
    // trusting it, or the allowlist model is defeated.
    public async Task<DeviceRecord> TouchAsync(string deviceId, string? userId, string? platform)
    {
        await EnsureLoadedAsync();
        await _lock.WaitAsync();
        try
        {
            var now = DateTime.UtcNow;
            if (_cache.TryGetValue(deviceId, out var rec))
            {
                rec.LastSeenUtc = now;
                if (userId != null) rec.UserId = userId;
                if (platform != null) rec.Platform = platform;
            }
            else
            {
                rec = new DeviceRecord
                {
                    DeviceId = deviceId,
                    UserId = userId,
                    Platform = platform,
                    FirstSeenUtc = now,
                    LastSeenUtc = now,
                };
                _cache[deviceId] = rec;
            }
            await SaveAsync();
            return rec;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<DeviceRecord> ApproveAsync(string deviceId)
    {
        await EnsureLoadedAsync();
        await _lock.WaitAsync();
        try
        {
            if (!_cache.TryGetValue(deviceId, out var rec))
            {
                rec = new DeviceRecord { DeviceId = deviceId, FirstSeenUtc = DateTime.UtcNow, LastSeenUtc = DateTime.UtcNow };
                _cache[deviceId] = rec;
            }
            rec.IsApproved = true;
            rec.ApprovedAtUtc = DateTime.UtcNow;
            await SaveAsync();
            return rec;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<IReadOnlyCollection<DeviceRecord>> ListAsync()
    {
        await EnsureLoadedAsync();
        await _lock.WaitAsync();
        try
        {
            return _cache.Values.OrderByDescending(d => d.LastSeenUtc).ToList();
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<DeviceRecord> BlacklistAsync(string deviceId, string? reason)
    {
        await EnsureLoadedAsync();
        await _lock.WaitAsync();
        try
        {
            if (!_cache.TryGetValue(deviceId, out var rec))
            {
                rec = new DeviceRecord { DeviceId = deviceId, FirstSeenUtc = DateTime.UtcNow, LastSeenUtc = DateTime.UtcNow };
                _cache[deviceId] = rec;
            }
            rec.IsBlacklisted = true;
            rec.BlacklistedAtUtc = DateTime.UtcNow;
            rec.BlacklistReason = reason;
            await SaveAsync();
            return rec;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<bool> UnblacklistAsync(string deviceId)
    {
        await EnsureLoadedAsync();
        await _lock.WaitAsync();
        try
        {
            if (!_cache.TryGetValue(deviceId, out var rec)) return false;
            rec.IsBlacklisted = false;
            rec.BlacklistedAtUtc = null;
            rec.BlacklistReason = null;
            await SaveAsync();
            return true;
        }
        finally
        {
            _lock.Release();
        }
    }
}
