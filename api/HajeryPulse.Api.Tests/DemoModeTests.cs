using System.Net;
using System.Security.Claims;
using System.Text.Json;
using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Demo;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace HajeryPulse.Api.Tests;

public sealed class DemoModeTests : IClassFixture<DemoApiFactory>
{
    private readonly DemoApiFactory _factory;
    private readonly HttpClient _demo;

    public DemoModeTests(DemoApiFactory factory)
    {
        _factory = factory;
        _demo = factory.ClientFor(DemoApiFactory.DemoOid);
    }

    public static readonly string[] Periods = { "day", "week", "month", "ytd" };

    // Wed, Sun (first day of week), last day of a month, first day of the year.
    public static readonly string[] Dates = { "2026-10-28", "2026-11-01", "2026-03-31", "2026-01-01" };

    public static IEnumerable<object[]> DatesAndPeriods() =>
        from d in Dates from p in Periods select new object[] { d, p };

    /// <summary>Every endpoint the app calls, with the filter variants each screen can send.</summary>
    private static IEnumerable<string> Endpoints(string d, string p)
    {
        yield return $"/api/v1/home/revenue-summary?asOfDate={d}&period={p}";
        yield return $"/api/v1/home/quick-kpis?asOfDate={d}";
        yield return $"/api/v1/finance/health?asOfDate={d}";
        yield return $"/api/v1/finance/ops?asOfDate={d}";

        foreach (var bt in new[] { "both", "wholesale", "tender" })
        {
            yield return $"/api/v1/sales/wt/summary?asOfDate={d}&bt={bt}&period={p}";
            yield return $"/api/v1/sales/wt/margin?asOfDate={d}&bt={bt}&period={p}";
            yield return $"/api/v1/sales/wt/quality?asOfDate={d}&bt={bt}&period={p}";
            foreach (var parent in new[] { "root", "BU1", "BU1.D1", "BU1.D1.W", "BU3.D2.T" })
            {
                yield return $"/api/v1/sales/wt/org?asOfDate={d}&bt={bt}&period={p}&parent={parent}";
                yield return $"/api/v1/sales/wt/top-brands?asOfDate={d}&bt={bt}&period={p}&limit=10&parent={parent}";
                yield return $"/api/v1/sales/wt/top-customers?asOfDate={d}&bt={bt}&period={p}&limit=10&parent={parent}";
            }
        }

        yield return $"/api/v1/fb/brands?asOfDate={d}&period={p}";
        foreach (var scope in new[] { "scopeType=all", "scopeType=brand&scopeId=DB2", "scopeType=outlet&scopeId=DB2-O1" })
        {
            foreach (var ep in new[] { "outlets", "summary", "brand-summary", "aggregators", "payments", "channels", "delivery-by-brand", "trends" })
                yield return $"/api/v1/fb/{ep}?asOfDate={d}&{scope}&period={p}";
            yield return $"/api/v1/fb/top-outlets?asOfDate={d}&{scope}&period={p}&limit=10";
        }

        yield return $"/api/v1/pharma/list?asOfDate={d}&period={p}";
        yield return $"/api/v1/pharma/top?asOfDate={d}&period={p}&limit=5";
        yield return $"/api/v1/pharma/discount-leaderboard?asOfDate={d}&period={p}&limit=5";
        foreach (var ph in new[] { "all", "PH03" })
            foreach (var ep in new[] { "summary", "trends", "margin", "quality", "channels", "payments", "categories", "rx-otc-mix" })
                yield return $"/api/v1/pharma/{ep}?asOfDate={d}&pharmacyId={ph}&period={p}";
    }

    private async Task<JsonElement> Get(string url, HttpClient? client = null)
    {
        var resp = await (client ?? _demo).GetAsync(url);
        var body = await resp.Content.ReadAsStringAsync();
        Assert.True(resp.StatusCode == HttpStatusCode.OK, $"{url} → {(int)resp.StatusCode}: {body}");
        return JsonDocument.Parse(body).RootElement.Clone();
    }

    private static decimal Dec(JsonElement e, string path)
    {
        foreach (var part in path.Split('.')) e = e.GetProperty(part);
        return e.GetDecimal();
    }

    // ------------------------------------------------------------ coverage

    [Theory]
    [MemberData(nameof(DatesAndPeriods))]
    public async Task Every_endpoint_returns_sample_data_for_the_demo_account(string d, string p)
    {
        foreach (var url in Endpoints(d, p))
        {
            var json = await Get(url);
            var empty = json.ValueKind == JsonValueKind.Array
                ? json.GetArrayLength() == 0
                : json.ValueKind != JsonValueKind.Object;
            // A leaf supplier has no children; everything else must have content.
            Assert.False(empty && !url.Contains("parent=BU3.D2.T.S"), $"{url} returned no data");
        }
    }

    [Fact]
    public async Task Same_request_returns_identical_numbers()
    {
        var url = "/api/v1/sales/wt/summary?asOfDate=2026-10-28&bt=both&period=month";
        var a = (await Get(url)).GetRawText();
        var b = (await Get(url)).GetRawText();
        Assert.Equal(a, b);
    }

    // ---------------------------------------------------------- consistency

    [Theory]
    [MemberData(nameof(DatesAndPeriods))]
    public async Task Home_total_equals_the_three_business_lines(string d, string p)
    {
        var home = await Get($"/api/v1/home/revenue-summary?asOfDate={d}&period={p}");
        var wt = await Get($"/api/v1/sales/wt/summary?asOfDate={d}&bt=both&period={p}");
        var fb = await Get($"/api/v1/fb/summary?asOfDate={d}&scopeType=all&period={p}");
        var ph = await Get($"/api/v1/pharma/summary?asOfDate={d}&pharmacyId=all&period={p}");

        var lines = Dec(wt, "revenue.kwd") + Dec(fb, "revenueKwd") + Dec(ph, "revenueKwd");
        Assert.InRange(Dec(home, "totalRevenueKwd") - lines, -0.01m, 0.01m);
        Assert.Equal(Dec(fb, "revenueKwd"), Dec(home, "fbRevenueKwd"));
        Assert.Equal(Dec(ph, "revenueKwd"), Dec(home, "pharmaRevenueKwd"));
    }

    [Theory]
    [InlineData("both")]
    [InlineData("wholesale")]
    [InlineData("tender")]
    public async Task Org_drill_down_children_add_up_to_their_parent(string bt)
    {
        const string q = "asOfDate=2026-10-28&period=month";
        var summary = await Get($"/api/v1/sales/wt/summary?{q}&bt={bt}");
        var expected = Dec(summary, "revenue.kwd");

        foreach (var parent in new[] { "root", "BU1", "BU1.D1", bt == "tender" ? "BU1.D1.T" : "BU1.D1.W" })
        {
            var node = await Get($"/api/v1/sales/wt/org?{q}&bt={bt}&parent={parent}");
            var children = node.GetProperty("children").EnumerateArray().ToArray();
            Assert.NotEmpty(children);

            var sum = children.Sum(c => c.GetProperty("total").GetDecimal());
            Assert.InRange(sum - expected, -0.05m, 0.05m);
            Assert.InRange(children.Sum(c => c.GetProperty("sharePct").GetDecimal()), 99.5m, 100.5m);

            // Next level down: the child we're about to drill into.
            var next = parent switch { "root" => "BU1", "BU1" => "BU1.D1", "BU1.D1" => bt == "tender" ? "BU1.D1.T" : "BU1.D1.W", _ => null };
            if (next is null) break;
            expected = children.Single(c => c.GetProperty("key").GetString() == next).GetProperty("total").GetDecimal();
        }
    }

    [Fact]
    public async Task Org_levels_match_the_app_labels()
    {
        const string q = "asOfDate=2026-10-28&bt=both&period=week";
        Assert.Equal("BusinessUnit", (await Get($"/api/v1/sales/wt/org?{q}&parent=root")).GetProperty("level").GetString());
        Assert.Equal("Division", (await Get($"/api/v1/sales/wt/org?{q}&parent=BU2")).GetProperty("level").GetString());
        Assert.Equal("BusinessType", (await Get($"/api/v1/sales/wt/org?{q}&parent=BU2.D1")).GetProperty("level").GetString());
        var suppliers = await Get($"/api/v1/sales/wt/org?{q}&parent=BU2.D1.W");
        Assert.Equal("Supplier", suppliers.GetProperty("level").GetString());
        Assert.All(suppliers.GetProperty("children").EnumerateArray(), c => Assert.Equal(0, c.GetProperty("hasChildren").GetInt32()));
    }

    [Theory]
    [InlineData("2026-10-28", "week", 4)]   // Sun..Wed
    [InlineData("2026-11-01", "week", 1)]   // Sunday
    [InlineData("2026-10-28", "month", 4)]  // days 1–28 → W1..W4
    [InlineData("2026-10-29", "month", 5)]  // day 29 starts W5
    [InlineData("2026-10-28", "ytd", 10)]   // Jan..Oct
    public async Task Sparklines_have_the_bucket_count_the_app_labels_expect(string d, string p, int buckets)
    {
        var wt = await Get($"/api/v1/sales/wt/summary?asOfDate={d}&bt=both&period={p}");
        Assert.Equal(buckets, wt.GetProperty("spark").GetArrayLength());
        Assert.Equal(buckets, wt.GetProperty("sparkLY").GetArrayLength());

        var fb = await Get($"/api/v1/fb/trends?asOfDate={d}&scopeType=all&period={p}");
        Assert.Equal(buckets, fb.GetProperty("current").GetArrayLength());

        var margin = await Get($"/api/v1/pharma/margin?asOfDate={d}&pharmacyId=all&period={p}");
        Assert.Equal(buckets, margin.GetProperty("trend").GetArrayLength());
    }

    [Theory]
    [InlineData("/api/v1/fb/channels?asOfDate=2026-10-28&scopeType=all&period=month")]
    [InlineData("/api/v1/fb/aggregators?asOfDate=2026-10-28&scopeType=brand&scopeId=DB3&period=week")]
    [InlineData("/api/v1/fb/payments?asOfDate=2026-10-28&scopeType=outlet&scopeId=DB1-O2&period=ytd")]
    [InlineData("/api/v1/pharma/channels?asOfDate=2026-10-28&pharmacyId=all&period=month")]
    [InlineData("/api/v1/pharma/payments?asOfDate=2026-10-28&pharmacyId=PH02&period=week")]
    [InlineData("/api/v1/pharma/categories?asOfDate=2026-10-28&pharmacyId=all&period=ytd")]
    public async Task Breakdown_percentages_add_up_to_100(string url)
    {
        var rows = (await Get(url)).EnumerateArray().ToArray();
        Assert.InRange(rows.Sum(r => r.GetProperty("pct").GetDecimal()), 99.5m, 100.5m);
    }

    [Fact]
    public async Task Prescription_category_matches_the_rx_otc_split()
    {
        const string q = "asOfDate=2026-10-28&pharmacyId=all&period=month";
        var mix = await Get($"/api/v1/pharma/rx-otc-mix?{q}");
        var rx = (await Get($"/api/v1/pharma/categories?{q}")).EnumerateArray().Single(c => c.GetProperty("key").GetString() == "rx");
        Assert.Equal(Dec(mix, "rxKwd"), rx.GetProperty("kwd").GetDecimal());
    }

    // ------------------------------------------------------------- isolation

    [Fact]
    public async Task Auth_me_flags_only_the_demo_account()
    {
        Assert.True((await Get("/api/v1/auth/me")).GetProperty("isDemo").GetBoolean());

        var regular = _factory.ClientFor(DemoApiFactory.RegularOid);
        await _factory.Services.GetRequiredService<HajeryPulse.Api.Services.IDeviceRegistryService>()
            .ApproveAsync("approved-device");
        regular.DefaultRequestHeaders.Remove("X-Device-Id");
        regular.DefaultRequestHeaders.Add("X-Device-Id", "approved-device");
        Assert.False((await Get("/api/v1/auth/me", regular)).GetProperty("isDemo").GetBoolean());
    }

    [Fact]
    public async Task Unapproved_device_is_blocked_for_regular_users_but_not_the_demo_account()
    {
        var regular = _factory.ClientFor(DemoApiFactory.RegularOid);
        var blocked = await regular.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Contains("DEVICE_NOT_APPROVED", await blocked.Content.ReadAsStringAsync());

        var demo = await _demo.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, demo.StatusCode);
    }

    [Fact]
    public async Task Blacklisted_device_is_blocked_even_for_the_demo_account()
    {
        var client = _factory.ClientFor(DemoApiFactory.DemoOid);
        client.DefaultRequestHeaders.Remove("X-Device-Id");
        client.DefaultRequestHeaders.Add("X-Device-Id", "blacklisted-device");
        await _factory.Services.GetRequiredService<HajeryPulse.Api.Services.IDeviceRegistryService>()
            .BlacklistAsync("blacklisted-device", "test");

        var resp = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
        Assert.Contains("DEVICE_BLOCKED", await resp.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData(DemoApiFactory.DemoOid, true)]
    [InlineData(DemoApiFactory.RegularOid, false)]
    [InlineData(null, false)]
    public void Repositories_are_chosen_by_the_callers_object_id(string? oid, bool expectDemo)
    {
        using var scope = _factory.Services.CreateScope();
        var accessor = scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>();
        accessor.HttpContext = new DefaultHttpContext { User = Principal(oid) };
        try
        {
            var types = new object[]
            {
                scope.ServiceProvider.GetRequiredService<ISalesRepository>(),
                scope.ServiceProvider.GetRequiredService<IPharmaRepository>(),
                scope.ServiceProvider.GetRequiredService<IFBRepository>(),
                scope.ServiceProvider.GetRequiredService<IFinanceRepository>(),
                scope.ServiceProvider.GetRequiredService<IHomeRepository>(),
            }.Select(r => r.GetType());

            Assert.All(types, t => Assert.Equal(expectDemo, t.Namespace == typeof(DemoMode).Namespace));
        }
        finally
        {
            accessor.HttpContext = null;
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void No_demo_user_when_the_list_is_missing_or_empty(string? configured)
    {
        var settings = new Dictionary<string, string?>();
        if (configured is not null) settings["DemoMode:UserObjectIds:0"] = configured;
        var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();

        Assert.False(Principal(DemoApiFactory.DemoOid).IsDemoUser(config));
        Assert.False(Principal("").IsDemoUser(config));
    }

    private static ClaimsPrincipal Principal(string? oid) => oid is null
        ? new ClaimsPrincipal(new ClaimsIdentity())
        : new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("http://schemas.microsoft.com/identity/claims/objectidentifier", oid) }, "Test"));
}
