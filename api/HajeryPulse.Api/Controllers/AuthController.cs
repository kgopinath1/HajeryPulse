using HajeryPulse.Api.Models.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HajeryPulse.Api.Controllers;

/// <summary>
/// Returns the signed-in user's identity, derived from the validated Entra ID
/// access token (see Program.cs's AddMicrosoftIdentityWebApi). No custom
/// token issuance happens here anymore — Entra ID is the sole source of
/// tokens; this endpoint just reflects back who the token belongs to.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/auth")]
public sealed class AuthController : ControllerBase
{
    [HttpGet("me")]
    public ActionResult<AuthUserDto> Me()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier)
                 ?? User.FindFirstValue("oid")
                 ?? User.FindFirstValue("sub")
                 ?? string.Empty;

        var name = User.FindFirstValue(ClaimTypes.Name)
                   ?? User.FindFirstValue("name")
                   ?? string.Empty;

        var email = User.FindFirstValue(ClaimTypes.Email)
                    ?? User.FindFirstValue("preferred_username")
                    ?? User.FindFirstValue("upn")
                    ?? string.Empty;

        // TODO: roles are not read from claims yet — every authenticated
        // user gets full access per the current (temporary) authorization
        // policy in Program.cs. Once a role source (App Roles vs groups)
        // is decided, map the relevant claim here instead of returning empty.
        var roles = Array.Empty<string>();
        var scopedBuCodes = Array.Empty<string>();

        return Ok(new AuthUserDto(
            Id: id,
            Name: name,
            Email: email,
            Roles: roles,
            ScopedBuCodes: scopedBuCodes));
    }

    [HttpPost("signout")]
    public ActionResult Signout()
    {
        // Nothing to revoke server-side — MSAL owns the token cache on-device.
        // Mobile calls this mainly so the API can log a sign-out event if
        // you want audit trail visibility; the actual session teardown
        // (clearing MSAL's cached account) happens on-device via signOutEntraId().
        return NoContent();
    }
}

public sealed record AuthUserDto(
    string Id, string Name, string Email,
    IReadOnlyCollection<string> Roles, IReadOnlyCollection<string> ScopedBuCodes);