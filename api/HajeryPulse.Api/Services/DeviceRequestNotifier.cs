using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Encodings.Web;
using Microsoft.Identity.Client;

namespace HajeryPulse.Api.Services;

/// <summary>A "Get token" request, as IT sees it in the email.</summary>
public sealed class DeviceTokenRequest
{
    public int RequestId { get; set; }
    public string Email { get; set; } = "";
    public string? DisplayName { get; set; }
    public string? Platform { get; set; }
    public string? DeviceName { get; set; }
    public string DeviceId { get; set; } = "";
    public DateTime RequestedUtc { get; set; }
    public int ActiveDevices { get; set; }
}

public interface IDeviceRequestNotifier
{
    /// <summary>Emails a token request to <paramref name="recipients"/>. False if it couldn't be sent.</summary>
    Task<bool> NotifyAsync(DeviceTokenRequest request, IReadOnlyCollection<string> recipients);
}

/// <summary>
/// Emails token requests (to the recipients in app.DeviceTokenRecipient) from
/// the DeviceTokens:NotifyFrom mailbox via Microsoft Graph, signed in as the API's own app registration
/// (EntraId:TenantId / ClientId + DeviceTokens:MailClientSecret). Needs the
/// Graph Mail.Send application permission, limited to the NotifyFrom mailbox
/// (see database/README.md).
/// </summary>
public sealed class GraphMailDeviceRequestNotifier : IDeviceRequestNotifier
{
    private static readonly string[] GraphScopes = { "https://graph.microsoft.com/.default" };

    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly ILogger<GraphMailDeviceRequestNotifier> _logger;
    private readonly Lazy<IConfidentialClientApplication?> _app;

    public GraphMailDeviceRequestNotifier(IHttpClientFactory http, IConfiguration config,
        ILogger<GraphMailDeviceRequestNotifier> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;
        // One instance for the app's lifetime, so MSAL reuses its cached Graph token.
        _app = new Lazy<IConfidentialClientApplication?>(() =>
        {
            var secret = config["DeviceTokens:MailClientSecret"];
            if (string.IsNullOrWhiteSpace(secret)) return null;
            return ConfidentialClientApplicationBuilder.Create(config["EntraId:ClientId"])
                .WithTenantId(config["EntraId:TenantId"])
                .WithClientSecret(secret)
                .Build();
        });
    }

    public async Task<bool> NotifyAsync(DeviceTokenRequest request, IReadOnlyCollection<string> recipients)
    {
        var from = _config["DeviceTokens:NotifyFrom"];

        if (recipients.Count == 0)
        {
            _logger.LogWarning("Device token request {RequestId} not emailed: no active rows in app.DeviceTokenRecipient", request.RequestId);
            return false;
        }
        if (_app.Value is null || string.IsNullOrWhiteSpace(from))
        {
            _logger.LogWarning("Device token request {RequestId} not emailed: DeviceTokens:NotifyFrom or MailClientSecret isn't set",
                request.RequestId);
            return false;
        }

        try
        {
            var auth = await _app.Value.AcquireTokenForClient(GraphScopes).ExecuteAsync();

            var who = string.IsNullOrWhiteSpace(request.DisplayName) ? request.Email : request.DisplayName;
            var message = new
            {
                message = new
                {
                    subject = $"Hajery Pulse: token request from {who}",
                    body = new { contentType = "HTML", content = Body(request, _config.GetValue("DeviceTokens:MaxActiveDevices", 2)) },
                    toRecipients = recipients.Select(a => new { emailAddress = new { address = a } }),
                },
                saveToSentItems = false,
            };

            using var client = _http.CreateClient(nameof(GraphMailDeviceRequestNotifier));
            using var req = new HttpRequestMessage(HttpMethod.Post,
                $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(from)}/sendMail")
            {
                Content = JsonContent.Create(message),
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

            using var resp = await client.SendAsync(req);
            if (resp.IsSuccessStatusCode) return true;

            _logger.LogWarning("Device token request {RequestId} not emailed: Graph returned {Status} {Body}",
                request.RequestId, (int)resp.StatusCode, await resp.Content.ReadAsStringAsync());
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Device token request {RequestId} not emailed", request.RequestId);
            return false;
        }
    }

    private static string Body(DeviceTokenRequest r, int maxActiveDevices)
    {
        static string E(string? s) => HtmlEncoder.Default.Encode(s ?? "");
        static string Row(string label, string? value) =>
            $"<tr><td style=\"padding:4px 12px 4px 0;color:#666\">{E(label)}</td><td style=\"padding:4px 0\">{E(value)}</td></tr>";

        return $@"<div style=""font-family:Segoe UI,Arial,sans-serif;font-size:14px"">
<p>{E(r.DisplayName ?? r.Email)} asked for a Hajery Pulse token for a device.</p>
<table>
{Row("User", r.DisplayName)}
{Row("Email", r.Email)}
{Row("Device", r.DeviceName)}
{Row("Platform", r.Platform)}
{Row("Device ID", r.DeviceId)}
{Row("Requested", r.RequestedUtc.AddHours(3).ToString("dd MMM yyyy HH:mm") + " (Kuwait)")}
{Row("Active devices", $"{r.ActiveDevices} of {maxActiveDevices}")}
{Row("Request ID", r.RequestId.ToString())}
</table>
<p>To issue the token (valid 2 hours), run in SSMS:</p>
<pre style=""background:#f4f4f4;padding:8px"">EXEC app.usp_Device_IssueToken @RequestId = {r.RequestId};</pre>
<p>Then give the token to the user. If the request isn't expected, ignore this email.</p>
</div>";
    }
}
