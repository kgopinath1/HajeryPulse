using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Xunit;

namespace HajeryPulse.Api.Tests;

/// <summary>
/// Runs the API with the real DeviceActivationService against a throwaway
/// SQL Server LocalDB database built from the same scripts IT runs
/// (database/01_schema/006_device_activation.sql and
/// database/03_procedures/sp_device_activation.sql), so codes are generated
/// exactly as in production — by app.usp_Device_GenerateActivationCode.
/// Needs LocalDB (installed with Visual Studio / SQL Server Express).
/// </summary>
public sealed class ActivationApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string Server = @"Server=(localdb)\MSSQLLocalDB;Integrated Security=true;TrustServerCertificate=true;";
    private readonly string _database = $"HajeryPulse_ActivationTests_{Guid.NewGuid():N}";

    public string ConnectionString => $"{Server}Database={_database};";

    public async Task InitializeAsync()
    {
        await using (var master = new SqlConnection(Server + "Database=master;"))
            await master.ExecuteAsync($"CREATE DATABASE [{_database}];");

        await using var db = new SqlConnection(ConnectionString);
        await db.ExecuteAsync("EXEC('CREATE SCHEMA dim AUTHORIZATION dbo;');");
        // Same shape as database/01_schema/002_dim_tables.sql.
        await db.ExecuteAsync(@"
CREATE TABLE dim.[User] (
    UserKey INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    EntraObjectId UNIQUEIDENTIFIER NOT NULL UNIQUE,
    Email NVARCHAR(255) NOT NULL,
    DisplayName NVARCHAR(200) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1);");

        foreach (var script in new[] { "01_schema/006_device_activation.sql", "03_procedures/sp_device_activation.sql" })
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
        builder.UseSetting("DeviceActivation:CheckCacheSeconds", "0");
        builder.UseSetting("DemoMode:UserObjectIds:0", DemoApiFactory.DemoOid);
        builder.ConfigureTestServices(TestAuthHandler.Register);
    }

    /// <summary>A client signed in as <paramref name="oid"/>, optionally sending a device key.</summary>
    public HttpClient ClientFor(Guid oid, string? deviceKey = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.OidHeader, oid.ToString());
        if (deviceKey is not null) client.DefaultRequestHeaders.Add("X-Device-Key", deviceKey);
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

public sealed class DeviceActivationTests : IClassFixture<ActivationApiFactory>
{
    private readonly ActivationApiFactory _factory;

    public DeviceActivationTests(ActivationApiFactory factory) => _factory = factory;

    // ------------------------------------------------------------- helpers

    private async Task<string> GenerateCode(Guid oid, string? email = null)
    {
        await using var db = new SqlConnection(_factory.ConnectionString);
        var row = await db.QuerySingleAsync("EXEC app.usp_Device_GenerateActivationCode @Email = @Email, @UserObjectId = @Oid;",
            new { Email = email ?? $"{oid:N}@hajery.com", Oid = oid });
        return (string)row.ActivationCode;
    }

    private async Task<(HttpStatusCode Status, string? Code, string? Message, string? DeviceKey)> Activate(Guid oid, string code)
    {
        var resp = await _factory.ClientFor(oid).PostAsJsonAsync("/api/v1/device/activate",
            new { code, platform = "ios", deviceName = "Apple iPhone 15 Pro" });
        var body = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;
        return resp.IsSuccessStatusCode
            ? (resp.StatusCode, null, null, body.GetProperty("deviceKey").GetString())
            : (resp.StatusCode, body.GetProperty("error").GetProperty("code").GetString(),
               body.GetProperty("error").GetProperty("message").GetString(), null);
    }

    private async Task<string> ActivatedKey(Guid oid)
    {
        var result = await Activate(oid, await GenerateCode(oid));
        Assert.Equal(HttpStatusCode.OK, result.Status);
        return result.DeviceKey!;
    }

    private async Task<(HttpStatusCode Status, string Body)> Me(Guid oid, string? deviceKey)
    {
        var resp = await _factory.ClientFor(oid, deviceKey).GetAsync("/api/v1/auth/me");
        return (resp.StatusCode, await resp.Content.ReadAsStringAsync());
    }

    private static string WrongCode(string code) => (code[0] == 'A' ? "B" : "A") + code[1..];

    // ---------------------------------------------------------------- tests

    [Fact]
    public async Task Generated_codes_are_8_characters_without_look_alikes()
    {
        for (var i = 0; i < 20; i++)
            Assert.Matches("^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$", await GenerateCode(Guid.NewGuid()));
    }

    [Fact]
    public async Task First_install_activates_with_the_code_then_the_key_works_on_every_request()
    {
        var oid = Guid.NewGuid();
        Assert.Contains("DEVICE_NOT_ACTIVATED", (await Me(oid, null)).Body);

        var code = await GenerateCode(oid);
        // Lower case, without the dash and with spaces, still works.
        var result = await Activate(oid, $" {code.Replace("-", "").ToLowerInvariant()} ");
        Assert.Equal(HttpStatusCode.OK, result.Status);
        Assert.True(result.DeviceKey!.Length >= 43); // 256-bit key

        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.OK, (await Me(oid, result.DeviceKey)).Status);
    }

    [Fact]
    public async Task Request_without_a_key_or_with_an_unknown_key_is_not_activated()
    {
        var oid = Guid.NewGuid();
        await ActivatedKey(oid);

        foreach (var key in new string?[] { null, "", "made-up-key" })
        {
            var (status, body) = await Me(oid, key);
            Assert.Equal(HttpStatusCode.Forbidden, status);
            Assert.Contains("DEVICE_NOT_ACTIVATED", body);
        }
    }

    [Fact]
    public async Task A_code_works_only_once()
    {
        var oid = Guid.NewGuid();
        var code = await GenerateCode(oid);
        Assert.Equal(HttpStatusCode.OK, (await Activate(oid, code)).Status);

        var again = await Activate(oid, code);
        Assert.Equal(HttpStatusCode.BadRequest, again.Status);
        Assert.Equal("CODE_USED", again.Code);
    }

    [Fact]
    public async Task Activating_a_new_device_revokes_the_previous_one()
    {
        var oid = Guid.NewGuid();
        var oldKey = await ActivatedKey(oid);
        var newKey = await ActivatedKey(oid);

        Assert.Equal(HttpStatusCode.OK, (await Me(oid, newKey)).Status);
        var (status, body) = await Me(oid, oldKey);
        Assert.Equal(HttpStatusCode.Forbidden, status);
        Assert.Contains("DEVICE_REVOKED", body);

        await using var db = new SqlConnection(_factory.ConnectionString);
        Assert.Equal(1, await db.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM app.UserDevice WHERE UserObjectId = @oid AND RevokedUtc IS NULL;", new { oid }));
    }

    [Fact]
    public async Task A_key_only_works_for_the_user_who_activated_it()
    {
        var owner = Guid.NewGuid();
        var key = await ActivatedKey(owner);

        var (status, body) = await Me(Guid.NewGuid(), key);
        Assert.Equal(HttpStatusCode.Forbidden, status);
        Assert.Contains("DEVICE_NOT_ACTIVATED", body);
    }

    [Fact]
    public async Task A_code_only_works_for_the_user_it_was_generated_for()
    {
        var owner = Guid.NewGuid();
        var code = await GenerateCode(owner);

        var stolen = await Activate(Guid.NewGuid(), code);
        Assert.Equal("CODE_INVALID", stolen.Code);

        // The other user's attempt didn't count against the owner's code.
        Assert.Equal(HttpStatusCode.OK, (await Activate(owner, code)).Status);
    }

    [Fact]
    public async Task Wrong_codes_count_down_then_lock_the_code()
    {
        var oid = Guid.NewGuid();
        var code = await GenerateCode(oid);

        for (var left = 4; left >= 1; left--)
        {
            var wrong = await Activate(oid, WrongCode(code));
            Assert.Equal("CODE_INVALID", wrong.Code);
            Assert.Contains($"{left} attempt", wrong.Message);
        }
        Assert.Equal("TOO_MANY_ATTEMPTS", (await Activate(oid, WrongCode(code))).Code);

        // Locked even for the right code — IT has to generate a new one.
        Assert.Equal("TOO_MANY_ATTEMPTS", (await Activate(oid, code)).Code);
        Assert.Equal(HttpStatusCode.OK, (await Activate(oid, await GenerateCode(oid))).Status);
    }

    [Fact]
    public async Task Expired_code_is_rejected()
    {
        var oid = Guid.NewGuid();
        var code = await GenerateCode(oid);
        await using (var db = new SqlConnection(_factory.ConnectionString))
            await db.ExecuteAsync("UPDATE app.DeviceActivationCode SET ExpiresUtc = DATEADD(MINUTE, -1, SYSUTCDATETIME()) WHERE UserObjectId = @oid;", new { oid });

        Assert.Equal("CODE_EXPIRED", (await Activate(oid, code)).Code);
    }

    [Fact]
    public async Task Codes_are_valid_for_48_hours_by_default()
    {
        var oid = Guid.NewGuid();
        await GenerateCode(oid);
        await using var db = new SqlConnection(_factory.ConnectionString);
        var hours = await db.ExecuteScalarAsync<int>(
            "SELECT DATEDIFF(HOUR, CreatedUtc, ExpiresUtc) FROM app.DeviceActivationCode WHERE UserObjectId = @oid;", new { oid });
        Assert.Equal(48, hours);
    }

    [Fact]
    public async Task Generating_a_new_code_cancels_the_unused_one()
    {
        var oid = Guid.NewGuid();
        var first = await GenerateCode(oid);
        var second = await GenerateCode(oid);

        Assert.Equal("CODE_INVALID", (await Activate(oid, first)).Code);
        Assert.Equal(HttpStatusCode.OK, (await Activate(oid, second)).Status);
    }

    [Fact]
    public async Task No_code_issued_is_invalid()
    {
        var result = await Activate(Guid.NewGuid(), "ABCD-EFGH");
        Assert.Equal(HttpStatusCode.BadRequest, result.Status);
        Assert.Equal("CODE_INVALID", result.Code);
    }

    [Fact]
    public async Task Empty_code_is_rejected_without_counting_an_attempt()
    {
        var oid = Guid.NewGuid();
        await GenerateCode(oid);
        Assert.Equal("CODE_REQUIRED", (await Activate(oid, "  ")).Code);

        await using var db = new SqlConnection(_factory.ConnectionString);
        Assert.Equal(0, await db.ExecuteScalarAsync<int>(
            "SELECT FailedAttempts FROM app.DeviceActivationCode WHERE UserObjectId = @oid;", new { oid }));
    }

    [Fact]
    public async Task IT_revoking_the_device_locks_it_out()
    {
        var oid = Guid.NewGuid();
        var key = await ActivatedKey(oid);

        await using (var db = new SqlConnection(_factory.ConnectionString))
            await db.ExecuteAsync("EXEC app.usp_Device_Revoke @UserObjectId = @oid, @Reason = N'Phone lost';", new { oid });

        Assert.Contains("DEVICE_REVOKED", (await Me(oid, key)).Body);
    }

    [Fact]
    public async Task IT_can_generate_list_and_cancel_by_email()
    {
        var oid = Guid.NewGuid();
        var email = $"exec.{oid:N}@hajery.com";
        await using var db = new SqlConnection(_factory.ConnectionString);
        await db.ExecuteAsync("INSERT INTO dim.[User] (EntraObjectId, Email, DisplayName) VALUES (@oid, @email, N'Test Exec');", new { oid, email });

        var code = (string)(await db.QuerySingleAsync("EXEC app.usp_Device_GenerateActivationCode @Email = @email;", new { email })).ActivationCode;
        Assert.Equal(HttpStatusCode.OK, (await Activate(oid, code)).Status);

        using (var lists = await db.QueryMultipleAsync("EXEC app.usp_Device_List @Email = @email;", new { email }))
        {
            var device = Assert.Single(await lists.ReadAsync());
            Assert.Equal("Active", (string)device.Status);
            Assert.Equal("Apple iPhone 15 Pro", (string)device.DeviceName);
            Assert.Equal("Used", (string)Assert.Single(await lists.ReadAsync()).Status);
        }

        await db.ExecuteAsync("EXEC app.usp_Device_GenerateActivationCode @Email = @email;", new { email });
        Assert.Equal(1, (int)(await db.QuerySingleAsync("EXEC app.usp_Device_CancelCodes @Email = @email;", new { email })).CodesCancelled);
    }

    [Fact]
    public async Task After_a_first_code_by_object_id_IT_can_use_the_email_alone()
    {
        var oid = Guid.NewGuid();
        var email = $"not.in.dim.{oid:N}@hajery.com";
        await using var db = new SqlConnection(_factory.ConnectionString);

        // Not in dim.[User] — the first code needs the Object ID.
        await GenerateCode(oid, email);

        var second = (string)(await db.QuerySingleAsync("EXEC app.usp_Device_GenerateActivationCode @Email = @email;", new { email })).ActivationCode;
        Assert.Equal(HttpStatusCode.OK, (await Activate(oid, second)).Status);

        using (var lists = await db.QueryMultipleAsync("EXEC app.usp_Device_List @Email = @email;", new { email }))
            Assert.Equal("Active", (string)Assert.Single(await lists.ReadAsync()).Status);
        Assert.Equal(1, (int)(await db.QuerySingleAsync("EXEC app.usp_Device_Revoke @Email = @email;", new { email })).DevicesRevoked);
    }

    [Fact]
    public async Task First_code_adds_the_user_to_dim_User_once()
    {
        var oid = Guid.NewGuid();
        var email = $"new.exec.{oid:N}@hajery.com";
        await using var db = new SqlConnection(_factory.ConnectionString);

        await db.ExecuteAsync("EXEC app.usp_Device_GenerateActivationCode @Email = @email, @UserObjectId = @oid, @DisplayName = N'New Exec';", new { email, oid });
        await db.ExecuteAsync("EXEC app.usp_Device_GenerateActivationCode @Email = @email, @UserObjectId = @oid, @DisplayName = N'Other Name';", new { email, oid });

        var user = Assert.Single(await db.QueryAsync("SELECT Email, DisplayName FROM dim.[User] WHERE EntraObjectId = @oid;", new { oid }));
        Assert.Equal(email, (string)user.Email);
        Assert.Equal("New Exec", (string)user.DisplayName);
    }

    [Fact]
    public async Task Email_already_linked_to_another_object_id_is_rejected()
    {
        var oid = Guid.NewGuid();
        var email = $"linked.{oid:N}@hajery.com";
        await using var db = new SqlConnection(_factory.ConnectionString);
        await db.ExecuteAsync("EXEC app.usp_Device_GenerateActivationCode @Email = @email, @UserObjectId = @oid;", new { email, oid });

        var ex = await Assert.ThrowsAsync<SqlException>(() => db.ExecuteAsync(
            "EXEC app.usp_Device_GenerateActivationCode @Email = @email, @UserObjectId = @other;", new { email, other = Guid.NewGuid() }));
        Assert.Contains("different Object ID", ex.Message);
    }

    [Fact]
    public async Task Unknown_email_tells_IT_to_pass_the_object_id()
    {
        await using var db = new SqlConnection(_factory.ConnectionString);
        var ex = await Assert.ThrowsAsync<SqlException>(() =>
            db.ExecuteAsync("EXEC app.usp_Device_GenerateActivationCode @Email = N'nobody@hajery.com';"));
        Assert.Contains("@UserObjectId", ex.Message);
    }

    [Fact]
    public async Task Demo_account_needs_no_device_key()
    {
        var (status, _) = await Me(Guid.Parse(DemoApiFactory.DemoOid), null);
        Assert.Equal(HttpStatusCode.OK, status);
    }

    [Fact]
    public async Task Signed_out_requests_get_401_not_a_device_error()
    {
        var resp = await _factory.CreateClient().GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }
}
