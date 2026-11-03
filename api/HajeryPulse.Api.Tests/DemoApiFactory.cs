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
/// <see cref="FakeDeviceTokens.ActiveToken"/> is activated, and a reporting
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
            services.RemoveAll<IDeviceTokenService>();
            services.AddSingleton<IDeviceTokenService, FakeDeviceTokens>();
        });
    }

    /// <summary>A client signed in as <paramref name="oid"/>, sending no device token.</summary>
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
    public const string EmailHeader = "X-Test-Email";

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

        var claims = new List<Claim>
        {
            new("http://schemas.microsoft.com/identity/claims/objectidentifier", oid),
            new(ClaimTypes.NameIdentifier, oid),
            new("name", "Test User"),
        };
        var email = Request.Headers[EmailHeader].ToString();
        if (!string.IsNullOrEmpty(email)) claims.Add(new Claim("preferred_username", email));

        var identity = new ClaimsIdentity(claims, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName)));
    }
}

/// <summary>Device check where every user is allowed and only <see cref="ActiveToken"/> is activated.</summary>
public sealed class FakeDeviceTokens : IDeviceTokenService
{
    public const string ActiveToken = "TEST-TOKN";

    public Task<DeviceCheck> CheckAsync(string? email, string? deviceId, string? token) =>
        Task.FromResult(new DeviceCheck(token == ActiveToken ? DeviceState.Active : DeviceState.NotRegistered));

    public Task<TokenRequestOutcome> RequestTokenAsync(string email, string? deviceId, string? platform, string? deviceName) =>
        Task.FromResult(TokenRequestOutcome.Notified);

    public Task<ActivationResult> ActivateAsync(string email, string? deviceId, string token) =>
        Task.FromResult(new ActivationResult(ActivationOutcome.TokenInvalid));
}
