using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Encodings.Web;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HajeryPulse.Api.Tests;

/// <summary>
/// Runs the real API in memory with: a test auth scheme (the caller's Entra
/// oid comes from the X-Test-Oid header), an in-memory device registry where
/// every device is unapproved, and a reporting DB connection string that
/// points nowhere — so any request that reaches a real repository fails.
/// </summary>
public sealed class DemoApiFactory : WebApplicationFactory<Program>
{
    public const string DemoOid = "11111111-1111-1111-1111-111111111111";
    public const string RegularOid = "22222222-2222-2222-2222-222222222222";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:ReportingDb",
            "Server=127.0.0.1,1;Database=none;User Id=none;Password=none;Connect Timeout=1;Encrypt=False");
        builder.UseSetting("DemoMode:UserObjectIds:0", DemoOid);

        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
            services.PostConfigure<AuthenticationOptions>(o =>
            {
                o.DefaultScheme = TestAuthHandler.SchemeName;
                o.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                o.DefaultChallengeScheme = TestAuthHandler.SchemeName;
            });

            services.RemoveAll<IDeviceRegistryService>();
            services.AddSingleton<IDeviceRegistryService, InMemoryDeviceRegistry>();
        });
    }

    public HttpClient ClientFor(string? oid)
    {
        var client = CreateClient();
        if (oid is not null) client.DefaultRequestHeaders.Add(TestAuthHandler.OidHeader, oid);
        client.DefaultRequestHeaders.Add("X-Device-Id", "test-device-unapproved");
        client.DefaultRequestHeaders.Add("X-Device-Platform", "ios");
        return client;
    }
}

public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";
    public const string OidHeader = "X-Test-Oid";

    public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var oid = Request.Headers[OidHeader].ToString();
        if (string.IsNullOrEmpty(oid)) return Task.FromResult(AuthenticateResult.NoResult());

        var identity = new ClaimsIdentity(new[]
        {
            new Claim("http://schemas.microsoft.com/identity/claims/objectidentifier", oid),
            new Claim(ClaimTypes.NameIdentifier, oid),
            new Claim("name", "Test User"),
        }, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}

/// <summary>Device registry where nothing is approved unless a test approves it.</summary>
public sealed class InMemoryDeviceRegistry : IDeviceRegistryService
{
    private readonly ConcurrentDictionary<string, DeviceRecord> _devices = new();

    public Task<DeviceRecord> TouchAsync(string deviceId, string? userId, string? platform) =>
        Task.FromResult(_devices.GetOrAdd(deviceId, id => new DeviceRecord
        {
            DeviceId = id, UserId = userId, Platform = platform,
            FirstSeenUtc = DateTime.UtcNow, LastSeenUtc = DateTime.UtcNow,
        }));

    public Task<IReadOnlyCollection<DeviceRecord>> ListAsync() =>
        Task.FromResult<IReadOnlyCollection<DeviceRecord>>(_devices.Values.ToArray());

    public Task<DeviceRecord> ApproveAsync(string deviceId)
    {
        var d = _devices.GetOrAdd(deviceId, id => new DeviceRecord { DeviceId = id });
        d.IsApproved = true;
        return Task.FromResult(d);
    }

    public Task<DeviceRecord> BlacklistAsync(string deviceId, string? reason)
    {
        var d = _devices.GetOrAdd(deviceId, id => new DeviceRecord { DeviceId = id });
        d.IsBlacklisted = true;
        d.BlacklistReason = reason;
        return Task.FromResult(d);
    }

    public Task<bool> UnblacklistAsync(string deviceId)
    {
        if (!_devices.TryGetValue(deviceId, out var d)) return Task.FromResult(false);
        d.IsBlacklisted = false;
        return Task.FromResult(true);
    }
}
