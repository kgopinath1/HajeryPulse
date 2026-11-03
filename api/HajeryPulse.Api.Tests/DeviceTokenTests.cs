using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace HajeryPulse.Api.Tests;

/// <summary>
/// Runs the API with the real DeviceTokenService against a throwaway SQL
/// Server LocalDB database built from the same scripts IT runs
/// (database/01_schema/006_device_activation.sql, 007_user_email_identity.sql
/// and database/03_procedures/sp_device_activation.sql), so tokens are
/// issued exactly as in production — by app.usp_Device_IssueToken. Emails to
/// IT are captured by <see cref="FakeNotifier"/> instead of being sent.
/// Needs LocalDB (installed with Visual Studio / SQL Server Express).
/// </summary>
public sealed class DeviceTokenApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string Server = @"Server=(localdb)\MSSQLLocalDB;Integrated Security=true;TrustServerCertificate=true;";
    private readonly string _database = $"HajeryPulse_DeviceTokenTests_{Guid.NewGuid():N}";

    public string ConnectionString => $"{Server}Database={_database};";
    public FakeNotifier Notifier { get; } = new();

    public async Task InitializeAsync()
    {
        await using (var master = new SqlConnection(Server + "Database=master;"))
            await master.ExecuteAsync($"CREATE DATABASE [{_database}];");

        await using var db = new SqlConnection(ConnectionString);
        await db.ExecuteAsync("EXEC('CREATE SCHEMA dim AUTHORIZATION dbo;');");
        // As created by database/01_schema/002_dim_tables.sql, before 007 changes it.
        await db.ExecuteAsync(@"
CREATE TABLE dim.[User] (
    UserKey         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EntraObjectId   UNIQUEIDENTIFIER  NOT NULL UNIQUE,
    Email           NVARCHAR(255)     NOT NULL,
    DisplayName     NVARCHAR(200)     NOT NULL,
    Roles           NVARCHAR(MAX)     NOT NULL DEFAULT N'[]',
    ScopedBuCodes   NVARCHAR(MAX)     NOT NULL DEFAULT N'[]',
    LastLoginAt     DATETIME2(0)      NULL,
    IsActive        BIT               NOT NULL DEFAULT 1,
    CreatedAt       DATETIME2(0)      NOT NULL DEFAULT SYSUTCDATETIME());");
        await db.ExecuteAsync("INSERT INTO dim.[User] (EntraObjectId, Email, DisplayName) VALUES (NEWID(), N'existing@hajery.com', N'Existing');");

        // 007 runs twice: IT may re-run it.
        foreach (var script in new[]
                 {
                     "01_schema/006_device_activation.sql", "01_schema/007_user_email_identity.sql",
                     "01_schema/007_user_email_identity.sql", "03_procedures/sp_device_activation.sql",
                 })
            foreach (var batch in Batches(File.ReadAllText(Path.Combine(DatabaseFolder(), script))))
                await db.ExecuteAsync(batch);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await DisposeAsync();
        SqlConnection.ClearAllPools();
        await using var master = new SqlConnection(Server + "Database=master;");
        await master.ExecuteAsync($"ALTER DATABASE [{_database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{_database}];");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:ReportingDb", ConnectionString);
        builder.UseSetting("DeviceTokens:CheckCacheSeconds", "0");
        builder.UseSetting("DemoMode:UserObjectIds:0", DemoApiFactory.DemoOid);
        builder.ConfigureTestServices(services =>
        {
            TestAuthHandler.Register(services);
            services.RemoveAll<IDeviceRequestNotifier>();
            services.AddSingleton<IDeviceRequestNotifier>(Notifier);
        });
    }

    /// <summary>A client signed in as <paramref name="email"/>, optionally sending a device ID and token.</summary>
    public HttpClient ClientFor(string email, string? deviceId = null, string? token = null, Guid? oid = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.OidHeader, (oid ?? Guid.NewGuid()).ToString());
        client.DefaultRequestHeaders.Add(TestAuthHandler.EmailHeader, email);
        if (deviceId is not null) client.DefaultRequestHeaders.Add("X-Device-Id", deviceId);
        if (token is not null) client.DefaultRequestHeaders.Add("X-Device-Token", token);
        return client;
    }

    // The scripts target HajeryPulse_Reporting; run them against the test DB instead.
    private static IEnumerable<string> Batches(string script) =>
        Regex.Split(script, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase)
            .Select(b => Regex.Replace(b, @"^\s*USE\s+\w+;\s*$", "", RegexOptions.Multiline | RegexOptions.IgnoreCase))
            .Where(b => !string.IsNullOrWhiteSpace(b));

    private static string DatabaseFolder()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, "database");
            if (File.Exists(Path.Combine(candidate, "01_schema", "006_device_activation.sql"))) return candidate;
        }
        throw new DirectoryNotFoundException("Couldn't find the repo's database/ folder.");
    }
}

/// <summary>Records the token requests IT would have been emailed.</summary>
public sealed class FakeNotifier : IDeviceRequestNotifier
{
    public ConcurrentBag<DeviceTokenRequest> Sent { get; } = new();
    public ConcurrentDictionary<string, IReadOnlyCollection<string>> RecipientsFor { get; } = new();
    public ConcurrentDictionary<string, bool> FailFor { get; } = new();

    public Task<bool> NotifyAsync(DeviceTokenRequest request, IReadOnlyCollection<string> recipients)
    {
        RecipientsFor[request.Email] = recipients;
        if (FailFor.ContainsKey(request.Email) || recipients.Count == 0) return Task.FromResult(false);
        Sent.Add(request);
        return Task.FromResult(true);
    }

    public int CountFor(string email) => Sent.Count(r => r.Email == email);
}

public sealed class DeviceTokenTests : IClassFixture<DeviceTokenApiFactory>
{
    private readonly DeviceTokenApiFactory _factory;

    public DeviceTokenTests(DeviceTokenApiFactory factory) => _factory = factory;

    // ------------------------------------------------------------- helpers

    private SqlConnection Db() => new(_factory.ConnectionString);

    private async Task<string> NewUser()
    {
        var email = $"user{Guid.NewGuid():N}@hajery.com";
        await using var db = Db();
        await db.ExecuteAsync("EXEC app.usp_User_Add @Email = @Email, @DisplayName = N'Test Exec';", new { Email = email });
        return email;
    }

    /// <summary>A phone's ID: an iOS identifierForVendor, or an Android ANDROID_ID.</summary>
    private static string NewIosDevice() => Guid.NewGuid().ToString().ToUpperInvariant();
    private static string NewAndroidDevice() => Guid.NewGuid().ToString("N")[..16];

    private async Task<bool> RequestToken(string email, string deviceId)
    {
        var resp = await _factory.ClientFor(email).PostAsJsonAsync("/api/v1/device/request-token",
            new { deviceId, platform = "ios", deviceName = "Apple iPhone 15 Pro" });
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        return JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement.GetProperty("itNotified").GetBoolean();
    }

    private async Task<int> RequestId(string email, string deviceId)
    {
        await using var db = Db();
        return await db.ExecuteScalarAsync<int>(
            "SELECT TOP 1 DeviceTokenId FROM app.DeviceToken WHERE UserEmail = @Email AND DeviceId = @DeviceId ORDER BY DeviceTokenId DESC;",
            new { Email = email, DeviceId = deviceId.ToUpperInvariant() });
    }

    private async Task<string> IssueToken(string email, string deviceId)
    {
        await using var db = Db();
        var row = await db.QuerySingleAsync("EXEC app.usp_Device_IssueToken @RequestId = @Id;", new { Id = await RequestId(email, deviceId) });
        return (string)row.Token;
    }

    private async Task<(HttpStatusCode Status, string? Code, string? Message)> Activate(string email, string deviceId, string token)
    {
        var resp = await _factory.ClientFor(email).PostAsJsonAsync("/api/v1/device/activate", new { deviceId, token });
        if (resp.IsSuccessStatusCode) return (resp.StatusCode, null, null);
        var error = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement.GetProperty("error");
        return (resp.StatusCode, error.GetProperty("code").GetString(), error.GetProperty("message").GetString());
    }

    /// <summary>Get token → IT issues → user enters it. Returns the token.</summary>
    private async Task<string> Activated(string email, string deviceId)
    {
        await RequestToken(email, deviceId);
        var token = await IssueToken(email, deviceId);
        Assert.Equal(HttpStatusCode.NoContent, (await Activate(email, deviceId, token)).Status);
        return token;
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> Me(string email, string? deviceId = null, string? token = null)
    {
        var resp = await _factory.ClientFor(email, deviceId, token).GetAsync("/api/v1/auth/me");
        var text = await resp.Content.ReadAsStringAsync();
        return (resp.StatusCode, JsonDocument.Parse(text).RootElement);
    }

    private async Task<int> ActiveDevices(string email)
    {
        await using var db = Db();
        return await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM app.DeviceToken WHERE UserEmail = @Email AND Status = 'Active';",
            new { Email = email });
    }

    private static string ErrorCode(JsonElement body) => body.GetProperty("error").GetProperty("code").GetString()!;
    private static string DeviceState(JsonElement body) =>
        body.GetProperty("error").GetProperty("device").GetProperty("state").GetString()!;
    private static int ActiveDevicesIn(JsonElement body) =>
        body.GetProperty("error").GetProperty("device").GetProperty("activeDevices").GetInt32();

    private static string WrongToken(string token) => (token[0] == 'A' ? "B" : "A") + token[1..];

    // ---------------------------------------------------------------- users

    [Fact]
    public async Task Users_not_in_dim_User_are_refused_everywhere_including_get_token()
    {
        const string stranger = "stranger@hajery.com";

        var me = await Me(stranger, NewIosDevice());
        Assert.Equal(HttpStatusCode.Forbidden, me.Status);
        Assert.Equal("USER_NOT_ALLOWED", ErrorCode(me.Body));

        var resp = await _factory.ClientFor(stranger).PostAsJsonAsync("/api/v1/device/request-token",
            new { deviceId = NewIosDevice(), platform = "ios" });
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        Assert.Contains("USER_NOT_ALLOWED", await resp.Content.ReadAsStringAsync());
        Assert.Equal(0, _factory.Notifier.CountFor(stranger));
    }

    [Fact]
    public async Task Email_and_device_id_matching_ignore_case()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        var token = await Activated(email.ToUpperInvariant(), device.ToLowerInvariant());
        Assert.Equal(HttpStatusCode.OK, (await Me(email, device, token)).Status);
    }

    [Fact]
    public async Task Deactivating_a_user_locks_them_out_and_turns_off_their_devices()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        var token = await Activated(email, device);

        await using (var db = Db())
        {
            var row = await db.QuerySingleAsync("EXEC app.usp_User_SetActive @Email = @Email, @IsActive = 0;", new { Email = email });
            Assert.Equal(1, (int)row.DevicesDeactivated);
        }
        Assert.Equal("USER_NOT_ALLOWED", ErrorCode((await Me(email, device, token)).Body));

        // Re-enabled, they need a new token: the old device stays off.
        await using (var db = Db())
            await db.ExecuteAsync("EXEC app.usp_User_Add @Email = @Email;", new { Email = email });
        Assert.Equal("DEVICE_REVOKED", ErrorCode((await Me(email, device, token)).Body));
    }

    [Fact]
    public async Task Users_are_keyed_by_email_without_an_object_id()
    {
        await using var db = Db();
        // 007 dropped the column and kept the existing user.
        Assert.Null(await db.ExecuteScalarAsync<int?>("SELECT COL_LENGTH('dim.[User]', 'EntraObjectId');"));
        Assert.Equal(1, await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dim.[User] WHERE Email = N'existing@hajery.com';"));

        // Adding the same email again re-enables it instead of duplicating it.
        var email = await NewUser();
        await db.ExecuteAsync("EXEC app.usp_User_SetActive @Email = @Email, @IsActive = 0;", new { Email = email });
        await db.ExecuteAsync("EXEC app.usp_User_Add @Email = @Email;", new { Email = email.ToUpperInvariant() });
        Assert.True(await db.ExecuteScalarAsync<bool>("SELECT IsActive FROM dim.[User] WHERE Email = @Email;", new { Email = email }));
        Assert.Equal(1, await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dim.[User] WHERE Email = @Email;", new { Email = email }));

        var device = NewIosDevice();
        var token = await Activated(email, device);
        Assert.Equal(HttpStatusCode.OK, (await Me(email, device, token)).Status);
    }

    // ------------------------------------------------------------- get token

    [Fact]
    public async Task New_device_is_asked_for_a_token()
    {
        var email = await NewUser();
        var me = await Me(email, NewAndroidDevice());
        Assert.Equal(HttpStatusCode.Forbidden, me.Status);
        Assert.Equal("DEVICE_NOT_ACTIVATED", ErrorCode(me.Body));
        Assert.Equal("none", DeviceState(me.Body));
        Assert.Equal(0, ActiveDevicesIn(me.Body));
    }

    [Fact]
    public async Task Get_token_emails_IT_once_with_the_device_id()
    {
        var email = await NewUser();
        var device = NewAndroidDevice();

        Assert.True(await RequestToken(email, device));

        var sent = Assert.Single(_factory.Notifier.Sent, r => r.Email == email);
        Assert.Equal(device.ToUpperInvariant(), sent.DeviceId);
        Assert.Equal("Test Exec", sent.DisplayName);
        Assert.Equal("Apple iPhone 15 Pro", sent.DeviceName);
        Assert.Equal(await RequestId(email, device), sent.RequestId);

        Assert.Equal("requested", DeviceState((await Me(email, device)).Body));

        // Tapping again keeps the same request and doesn't email IT again.
        await RequestToken(email, device);
        Assert.Equal(1, _factory.Notifier.CountFor(email));
        Assert.Equal(await RequestId(email, device), sent.RequestId);
    }

    [Fact]
    public async Task Recipients_come_from_the_table_and_changes_apply_immediately()
    {
        await using var db = Db();
        var recipients = (await db.QueryAsync<string>("SELECT Email FROM app.DeviceTokenRecipient WHERE IsActive = 1 ORDER BY Email;")).ToList();
        Assert.Equal(new[] { "keerthana.gopinath@hajery.com", "sherin.mathew@hajery.com" }, recipients);

        var email = await NewUser();
        await RequestToken(email, NewIosDevice());
        Assert.Equal(recipients, _factory.Notifier.RecipientsFor[email]);

        // IT adds someone from SSMS; the next request goes to them too.
        const string extra = "it.support@hajery.com";
        await db.ExecuteAsync("EXEC app.usp_Device_SetRecipient @Email = @Email;", new { Email = extra });
        try
        {
            var next = await NewUser();
            await RequestToken(next, NewIosDevice());
            Assert.Contains(extra, _factory.Notifier.RecipientsFor[next]);
        }
        finally
        {
            await db.ExecuteAsync("EXEC app.usp_Device_SetRecipient @Email = @Email, @IsActive = 0;", new { Email = extra });
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("not a device id!")]
    public async Task Get_token_needs_a_device_id(string? deviceId)
    {
        var email = await NewUser();
        var resp = await _factory.ClientFor(email).PostAsJsonAsync("/api/v1/device/request-token", new { deviceId, platform = "ios" });
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Contains("DEVICE_ID_INVALID", await resp.Content.ReadAsStringAsync());
        Assert.Equal(0, _factory.Notifier.CountFor(email));
    }

    [Fact]
    public async Task Request_is_kept_when_the_email_to_IT_fails()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        _factory.Notifier.FailFor[email] = true;

        Assert.False(await RequestToken(email, device));

        await using var db = Db();
        var open = await db.QueryAsync("EXEC app.usp_Device_Requests;");
        Assert.Contains(open, r => (string)r.UserEmail == email && (string)r.Status == "Waiting for IT");
        Assert.Equal("requested", DeviceState((await Me(email, device)).Body));
    }

    // ------------------------------------------------------------ tokens

    [Fact]
    public async Task Issued_tokens_are_8_characters_without_look_alikes_and_valid_2_hours()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        await RequestToken(email, device);

        await using var db = Db();
        var row = await db.QuerySingleAsync("EXEC app.usp_Device_IssueToken @RequestId = @Id;", new { Id = await RequestId(email, device) });
        Assert.Matches("^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$", (string)row.Token);
        var validFor = (DateTime)row.ExpiresUtc - DateTime.UtcNow;
        Assert.InRange(validFor.TotalMinutes, 118, 121);
        Assert.Equal("issued", DeviceState((await Me(email, device)).Body));
    }

    [Fact]
    public async Task Entered_token_unlocks_this_device()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        var token = await Activated(email, device);

        Assert.Equal(HttpStatusCode.OK, (await Me(email, device, token)).Status);
        // Typed in lower case, without the dash, works the same.
        Assert.Equal(HttpStatusCode.OK, (await Me(email, device, token.Replace("-", "").ToLowerInvariant())).Status);
    }

    [Fact]
    public async Task Token_only_works_with_its_own_device_and_user()
    {
        var email = await NewUser();
        var other = await NewUser();
        var device = NewIosDevice();
        var token = await Activated(email, device);

        Assert.Equal("none", DeviceState((await Me(email, NewIosDevice(), token)).Body));
        Assert.Equal("known", DeviceState((await Me(email, device, WrongToken(token))).Body));
        Assert.Equal("none", DeviceState((await Me(other, device, token)).Body));
        Assert.Equal("TOKEN_NOT_ISSUED", (await Activate(other, device, token)).Code);
    }

    [Fact]
    public async Task Token_cannot_be_entered_before_IT_issues_it()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        await RequestToken(email, device);
        Assert.Equal("TOKEN_NOT_ISSUED", (await Activate(email, device, "ABCD-EFGH")).Code);
    }

    [Fact]
    public async Task Wrong_tokens_count_down_then_lock_until_get_token_again()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        await RequestToken(email, device);
        var token = await IssueToken(email, device);

        for (var left = 4; left >= 1; left--)
        {
            var result = await Activate(email, device, WrongToken(token));
            Assert.Equal("TOKEN_INVALID", result.Code);
            Assert.Contains($"({left} attempt", result.Message);
        }
        Assert.Equal("TOO_MANY_ATTEMPTS", (await Activate(email, device, WrongToken(token))).Code);
        Assert.Equal("TOO_MANY_ATTEMPTS", (await Activate(email, device, token)).Code);

        // Get token again: back to waiting for IT, and IT is emailed again.
        await RequestToken(email, device);
        Assert.Equal(2, _factory.Notifier.CountFor(email));
        Assert.Equal("requested", DeviceState((await Me(email, device)).Body));

        var newToken = await IssueToken(email, device);
        Assert.Equal(HttpStatusCode.NoContent, (await Activate(email, device, newToken)).Status);
    }

    [Fact]
    public async Task Expired_token_is_refused()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        await RequestToken(email, device);
        var token = await IssueToken(email, device);

        await using (var db = Db())
            await db.ExecuteAsync("UPDATE app.DeviceToken SET TokenExpiresUtc = DATEADD(MINUTE, -1, SYSUTCDATETIME()) WHERE DeviceTokenId = @Id;",
                new { Id = await RequestId(email, device) });

        Assert.Equal("TOKEN_EXPIRED", (await Activate(email, device, token)).Code);
    }

    [Fact]
    public async Task Issuing_again_replaces_the_earlier_token()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        await RequestToken(email, device);
        var first = await IssueToken(email, device);
        var second = await IssueToken(email, device);

        Assert.Equal("TOKEN_INVALID", (await Activate(email, device, first)).Code);
        Assert.Equal(HttpStatusCode.NoContent, (await Activate(email, device, second)).Status);
    }

    // ----------------------------------------------------------- reinstall

    [Fact]
    public async Task Ios_reinstall_keeps_working_with_the_token_from_the_keychain()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        var token = await Activated(email, device);

        // Same device ID and token after reinstall: straight in, same single device.
        Assert.Equal(HttpStatusCode.OK, (await Me(email, device, token)).Status);
        Assert.Equal(1, await ActiveDevices(email));
    }

    [Fact]
    public async Task Android_reinstall_asks_for_the_same_token_again()
    {
        var email = await NewUser();
        var device = NewAndroidDevice();
        var token = await Activated(email, device);

        // Storage wiped: same device ID, no token.
        var me = await Me(email, device);
        Assert.Equal("DEVICE_NOT_ACTIVATED", ErrorCode(me.Body));
        Assert.Equal("known", DeviceState(me.Body));

        Assert.Equal(HttpStatusCode.NoContent, (await Activate(email, device, token)).Status);
        Assert.Equal(HttpStatusCode.OK, (await Me(email, device, token)).Status);
        Assert.Equal(1, await ActiveDevices(email));
        Assert.Equal(1, _factory.Notifier.CountFor(email));
    }

    [Fact]
    public async Task Lost_token_after_reinstall_get_token_reopens_the_same_device_and_ends_the_old_token()
    {
        var email = await NewUser();
        var device = NewAndroidDevice();
        var oldToken = await Activated(email, device);
        var requestId = await RequestId(email, device);

        await RequestToken(email, device);
        Assert.Equal(2, _factory.Notifier.CountFor(email));
        Assert.Equal(requestId, await RequestId(email, device));
        Assert.Equal("requested", DeviceState((await Me(email, device, oldToken)).Body));
        Assert.Equal(0, await ActiveDevices(email));

        var newToken = await IssueToken(email, device);
        Assert.Equal(HttpStatusCode.NoContent, (await Activate(email, device, newToken)).Status);
        Assert.Equal(HttpStatusCode.OK, (await Me(email, device, newToken)).Status);
        Assert.Equal("known", DeviceState((await Me(email, device, oldToken)).Body));
    }

    [Fact]
    public async Task Guessing_the_token_of_an_active_device_locks_reentry_but_not_the_phone_that_has_it()
    {
        var email = await NewUser();
        var device = NewAndroidDevice();
        var token = await Activated(email, device);

        for (var i = 0; i < DeviceTokenService.MaxFailedAttempts; i++)
            await Activate(email, device, WrongToken(token));

        Assert.Equal("TOO_MANY_ATTEMPTS", (await Activate(email, device, token)).Code);
        Assert.Equal(HttpStatusCode.OK, (await Me(email, device, token)).Status);
    }

    [Fact]
    public async Task Shared_phone_two_users_same_device_id_each_with_their_own_token()
    {
        var alice = await NewUser();
        var bob = await NewUser();
        var device = NewIosDevice();

        var aliceToken = await Activated(alice, device);
        var bobToken = await Activated(bob, device);

        Assert.Equal(HttpStatusCode.OK, (await Me(alice, device, aliceToken)).Status);
        Assert.Equal(HttpStatusCode.OK, (await Me(bob, device, bobToken)).Status);
        Assert.Equal("known", DeviceState((await Me(bob, device, aliceToken)).Body));
    }

    // ----------------------------------------------------------- devices

    [Fact]
    public async Task Two_devices_can_be_active_but_not_a_third()
    {
        var email = await NewUser();
        var phone = NewIosDevice();
        var tablet = NewAndroidDevice();
        var phoneToken = await Activated(email, phone);
        var tabletToken = await Activated(email, tablet);

        Assert.Equal(HttpStatusCode.OK, (await Me(email, phone, phoneToken)).Status);
        Assert.Equal(HttpStatusCode.OK, (await Me(email, tablet, tabletToken)).Status);

        // A third device sees how many are active, so the app can explain.
        var third = NewIosDevice();
        Assert.Equal(2, ActiveDevicesIn((await Me(email, third)).Body));

        await RequestToken(email, third);
        var requestId = await RequestId(email, third);
        await using var db = Db();
        var ex = await Assert.ThrowsAsync<SqlException>(() =>
            db.ExecuteAsync("EXEC app.usp_Device_IssueToken @RequestId = @Id;", new { Id = requestId }));
        Assert.Equal(50010, ex.Number);
    }

    [Fact]
    public async Task Third_token_issued_before_the_limit_was_reached_still_cannot_activate()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        await RequestToken(email, device);
        var token = await IssueToken(email, device);
        await Activated(email, NewIosDevice());
        await Activated(email, NewAndroidDevice());

        Assert.Equal("DEVICE_LIMIT", (await Activate(email, device, token)).Code);
    }

    [Fact]
    public async Task Deactivated_device_is_revoked_and_get_token_starts_a_new_request()
    {
        var email = await NewUser();
        var phone = NewIosDevice();
        var tablet = NewIosDevice();
        var phoneToken = await Activated(email, phone);
        var tabletToken = await Activated(email, tablet);
        var oldRequest = await RequestId(email, phone);

        await using (var db = Db())
        {
            var row = await db.QuerySingleAsync("EXEC app.usp_Device_Deactivate @DeviceTokenId = @Id, @Reason = N'Phone lost';",
                new { Id = oldRequest });
            Assert.Equal(1, (int)row.DevicesDeactivated);
        }

        var me = await Me(email, phone, phoneToken);
        Assert.Equal("DEVICE_REVOKED", ErrorCode(me.Body));
        Assert.Equal(1, ActiveDevicesIn(me.Body));
        Assert.Equal(HttpStatusCode.OK, (await Me(email, tablet, tabletToken)).Status);
        Assert.Equal("TOKEN_NOT_ISSUED", (await Activate(email, phone, phoneToken)).Code);

        await RequestToken(email, phone);
        Assert.NotEqual(oldRequest, await RequestId(email, phone));

        await using (var db = Db())
        {
            var devices = (await db.QueryAsync("EXEC app.usp_Device_List @Email = @Email;", new { Email = email })).ToList();
            Assert.Equal(3, devices.Count);
            Assert.Contains(devices, d => (string)d.Status == "Inactive" && (string)d.InactiveReason == "Phone lost");
        }
    }

    [Fact]
    public async Task Device_endpoints_need_no_token_but_everything_else_does()
    {
        var email = await NewUser();
        var device = NewIosDevice();
        await RequestToken(email, device);
        var resp = await _factory.ClientFor(email, device).GetAsync("/api/v1/home/summary");
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Demo_account_needs_no_user_row_or_token()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.OidHeader, DemoApiFactory.DemoOid);
        client.DefaultRequestHeaders.Add(TestAuthHandler.EmailHeader, "reviewer@hajery.com");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/auth/me")).StatusCode);
    }
}
