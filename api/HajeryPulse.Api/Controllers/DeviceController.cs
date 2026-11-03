using HajeryPulse.Api.Auth;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HajeryPulse.Api.Controllers;

public sealed record RequestTokenRequest(string? DeviceId, string? Platform, string? DeviceName);
public sealed record RequestTokenResponse(bool ItNotified);
public sealed record ActivateDeviceRequest(string? DeviceId, string? Token);

/// <summary>
/// "Get token" and token entry for a device. DeviceControlMiddleware
/// lets only active users (dim.[User]) reach these, without a device token.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/device")]
public sealed class DeviceController : ControllerBase
{
    private readonly IDeviceTokenService _devices;

    public DeviceController(IDeviceTokenService devices) => _devices = devices;

    /// <summary>Records a token request for this device (the phone's own ID) and emails IT.</summary>
    [HttpPost("request-token")]
    public async Task<ActionResult<RequestTokenResponse>> RequestToken([FromBody] RequestTokenRequest req)
    {
        if (User.GetEmail() is not { } email) return Forbid();
        var outcome = await _devices.RequestTokenAsync(email, req.DeviceId, req.Platform, req.DeviceName);
        if (outcome == TokenRequestOutcome.InvalidDeviceId)
            return Error("DEVICE_ID_INVALID", "This device couldn't be identified. Please update the app and try again.");
        return Ok(new RequestTokenResponse(outcome != TokenRequestOutcome.NotifyFailed));
    }

    [HttpPost("activate")]
    public async Task<ActionResult> Activate([FromBody] ActivateDeviceRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token))
            return Error("TOKEN_REQUIRED", "Enter the token from IT.");

        if (User.GetEmail() is not { } email) return Forbid();

        var result = await _devices.ActivateAsync(email, req.DeviceId, req.Token);
        return result.Outcome switch
        {
            ActivationOutcome.Activated => NoContent(),
            ActivationOutcome.NotIssued => Error("TOKEN_NOT_ISSUED",
                "IT hasn't issued a token for this device yet. Tap \"Get token\" if you haven't already."),
            ActivationOutcome.TokenExpired => Error("TOKEN_EXPIRED",
                "This token has expired. Tap \"Get token\" to ask IT for a new one."),
            ActivationOutcome.TooManyAttempts => Error("TOO_MANY_ATTEMPTS",
                "Too many incorrect attempts. Tap \"Get token\" to ask IT for a new one."),
            ActivationOutcome.DeviceLimit => Error("DEVICE_LIMIT",
                "You already have the maximum number of devices. Ask IT to turn one off, then try again."),
            _ => Error("TOKEN_INVALID", result.AttemptsLeft > 0
                ? $"That token isn't right. Check it and try again ({result.AttemptsLeft} {(result.AttemptsLeft == 1 ? "attempt" : "attempts")} left)."
                : "That token isn't valid for this device. Check it, or tap \"Get token\" for a new one."),
        };
    }

    private BadRequestObjectResult Error(string code, string message) =>
        BadRequest(new { error = new { code, message } });
}
