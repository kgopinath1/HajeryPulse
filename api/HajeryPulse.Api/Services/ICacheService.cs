//using System.Text.Json;
//using StackExchange.Redis;

//namespace HajeryPulse.Api.Services;

//public interface ICacheService
//{
//    Task<T?> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<Task<T>> factory) where T : class;
//    Task RemoveAsync(string key);
//}

//public sealed class RedisCacheService : ICacheService
//{
//    private readonly IDatabase _db;
//    private readonly ILogger<RedisCacheService> _logger;

//    public RedisCacheService(IConnectionMultiplexer mux, ILogger<RedisCacheService> logger)
//    {
//        _db = mux.GetDatabase();
//        _logger = logger;
//    }

//    public async Task<T?> GetOrSetAsync<T>(string key, TimeSpan ttl, Func<Task<T>> factory) where T : class
//    {
//        try
//        {
//            var hit = await _db.StringGetAsync(key);
//            if (hit.HasValue) return JsonSerializer.Deserialize<T>(hit!);
//        }
//        catch (Exception ex)
//        {
//            _logger.LogWarning(ex, "Cache GET failed for {Key}", key);
//        }

//        var value = await factory();
//        try
//        {
//            await _db.StringSetAsync(key, JsonSerializer.Serialize(value), ttl);
//        }
//        catch (Exception ex)
//        {
//            _logger.LogWarning(ex, "Cache SET failed for {Key}", key);
//        }
//        return value;
//    }

//    public Task RemoveAsync(string key) => _db.KeyDeleteAsync(key);
//}
