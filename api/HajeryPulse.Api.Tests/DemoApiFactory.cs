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
/// oid comes from the X-Test-Oid header), a device check where only
/// <see cref="FakeDeviceActivation.ActiveKey"/> is activated, and a reporting
/// DB connection string that points nowhere — so any request that reaches a
/// real repository fails.
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
            TestAuthHandler.Register(services);
            services.RemoveAll<IDeviceActivationService>();
            services.AddSingleton<IDeviceActivationService, FakeDeviceActivation>();
        });
    }

    /// <summary>A client signed in as <paramref name="oid"/>, sending no device key.</summary>
    public HttpClient ClientFor(string? oid)
    {
        var client = CreateClient();
        if (oid is not null) client.DefaultRequestHeaders.Add(TestAuthHandler.OidHeader, oid);
        return client;
    }
}

public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";
    public const string OidHeader = "X-Test-Oid";

    public static void Register(IServiceCollection services)
    {
        services.AddAuthentication(SchemeName)
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(SchemeName, _ => { });
        services.PostConfigure<AuthenticationOptions>(o =>
        {
            o.DefaultScheme = SchemeName;
            o.DefaultAuthenticateScheme = SchemeName;
            o.DefaultChallengeScheme = SchemeName;
        });
    }

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

/// <summary>Device check where only <see cref="ActiveKey"/> is activated, for any user.</summary>
public sealed class FakeDeviceActivation : IDeviceActivationService
{
    public const string ActiveKey = "test-active-device-key";

    public Task<DeviceKeyStatus> CheckAsync(Guid userObjectId, string? deviceKey) =>
        Task.FromResult(deviceKey == ActiveKey ? DeviceKeyStatus.Active : DeviceKeyStatus.NotActivated);

    public Task<ActivationResult> ActivateAsync(Guid userObjectId, string code, string? platform, string? deviceName) =>
        Task.FromResult(new ActivationResult(ActivationOutcome.CodeInvalid));
}
