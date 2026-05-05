namespace HajeryPulse.Api.Auth;

/// <summary>
/// Strongly-typed view of the EntraId section in appsettings.json.
/// Bound automatically by Microsoft.Identity.Web.AddMicrosoftIdentityWebApi.
/// </summary>
public sealed class EntraIdOptions
{
    public string Instance     { get; init; } = "https://login.microsoftonline.com/";
    public string Domain       { get; init; } = string.Empty;
    public string TenantId     { get; init; } = string.Empty;
    public string ClientId     { get; init; } = string.Empty;
    public string Audience     { get; init; } = string.Empty;
    public string CallbackPath { get; init; } = "/signin-oidc";
}
