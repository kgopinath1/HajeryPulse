using HajeryPulse.Api.Models.Dto;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace HajeryPulse.Api.Controllers;

/// <summary>
/// Auth code exchange + refresh endpoints. STUBBED — wire to Microsoft.Identity.Web's
/// confidential client flow before production.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/v1/auth")]
public sealed class AuthController : ControllerBase
{
    private string GenerateJwtToken(IEnumerable<Claim> claims)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes("TTHIS_IS_MY_DEV_SECRET_KEY_1234567890"));

        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }


    //[HttpPost("exchange")]
    //public ActionResult<AuthSessionDto> Exchange([FromBody] AuthExchangeRequest req)
    //{
    //    // TODO: exchange the code with Entra ID via OnBehalfOf or confidential
    //    // client; the stub returns a fixed session so the mobile app can run
    //    // against a dev API.
    //    return Ok(new AuthSessionDto(
    //        AccessToken:  "dev-stub-access-token",
    //        RefreshToken: "dev-stub-refresh-token",
    //        ExpiresAt:    DateTime.UtcNow.AddHours(1),
    //        User: new AuthUserDto(
    //            Id:     Guid.NewGuid().ToString(),
    //            Name:   "Demo Executive",
    //            Email:  "demo@hajerygroup.com",
    //            Roles:  new[] { "ceo", "approver_lpo", "approver_asset" },
    //            ScopedBuCodes: Array.Empty<string>())
    //    ));
    //}


    [HttpPost("exchange")]
    public ActionResult<AuthSessionDto> Exchange([FromBody] AuthExchangeRequest req)
    {
        var claims = new[]
        {
        new Claim(ClaimTypes.Name, "Demo Executive"),
        new Claim(ClaimTypes.Email, "demo@hajerygroup.com"),
        new Claim(ClaimTypes.Role, "ceo"),
        new Claim(ClaimTypes.Role, "approver_lpo"),
        new Claim(ClaimTypes.Role, "approver_asset")
    };

        //var key = new SymmetricSecurityKey(
        //    Encoding.UTF8.GetBytes("TTHIS_IS_MY_DEV_SECRET_KEY_1234567890"));

        //var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        //var token = new JwtSecurityToken(
        //    claims: claims,
        //    expires: DateTime.UtcNow.AddHours(1),
        //    signingCredentials: creds
        //);

        // var jwt = new JwtSecurityTokenHandler().WriteToken(token);
        var jwt = GenerateJwtToken(claims);

        return Ok(new AuthSessionDto(
            AccessToken: jwt,
            RefreshToken: "dev-refresh",
            ExpiresAt: DateTime.UtcNow.AddHours(1),
            User: new AuthUserDto(
                Id: Guid.NewGuid().ToString(),
                Name: "Demo Executive",
                Email: "demo@hajerygroup.com",
                Roles: new[] { "ceo", "approver_lpo", "approver_asset" },
                ScopedBuCodes: Array.Empty<string>())
        ));
    }


    //[HttpPost("refresh")]
    //public ActionResult<AuthSessionDto> Refresh([FromBody] RefreshRequest req)
    //{
    //    // TODO: validate refresh token, return new access + refresh
    //    return Ok(new AuthSessionDto(

    //         AccessToken:  "dev-stub-access-token-refreshed",
    //        RefreshToken: req.RefreshToken,
    //        ExpiresAt:    DateTime.UtcNow.AddHours(1),
    //        User: new AuthUserDto(
    //            Id:     Guid.NewGuid().ToString(),
    //            Name:   "Demo Executive",
    //            Email:  "demo@hajerygroup.com",
    //            Roles:  new[] { "ceo" },
    //            ScopedBuCodes: Array.Empty<string>())
    //    ));
    //}

    [HttpPost("refresh")]
    public ActionResult<AuthSessionDto> Refresh([FromBody] RefreshRequest req)
    {
        // TODO: validate refresh token properly

        var claims = new[]
        {
        new Claim(ClaimTypes.Name, "Demo Executive"),
        new Claim(ClaimTypes.Email, "demo@hajerygroup.com"),
        new Claim(ClaimTypes.Role, "ceo"),
        new Claim(ClaimTypes.Role, "approver_lpo"),
        new Claim(ClaimTypes.Role, "approver_asset")
    };

        var jwt = GenerateJwtToken(claims);

        return Ok(new AuthSessionDto(
            AccessToken: jwt,
            RefreshToken: req.RefreshToken, // reuse or rotate
            ExpiresAt: DateTime.UtcNow.AddHours(1),
            User: new AuthUserDto(
                Id: Guid.NewGuid().ToString(),
                Name: "Demo Executive",
                Email: "demo@hajerygroup.com",
                Roles: new[] { "ceo", "approver_lpo", "approver_asset" },
                ScopedBuCodes: Array.Empty<string>())
        ));
    }


    [HttpPost("signout")]
    [Authorize]
    public ActionResult Signout()
    {
        // TODO: revoke refresh token at Entra ID
        return NoContent();
    }
}

public sealed record AuthExchangeRequest(string Code, string CodeVerifier);
public sealed record RefreshRequest(string RefreshToken);

public sealed record AuthSessionDto(
    string AccessToken, string RefreshToken, DateTime ExpiresAt, AuthUserDto User);

public sealed record AuthUserDto(
    string Id, string Name, string Email,
    IReadOnlyCollection<string> Roles, IReadOnlyCollection<string> ScopedBuCodes);
