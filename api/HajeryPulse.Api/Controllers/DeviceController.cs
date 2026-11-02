using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Web;

namespace HajeryPulse.Api.Controllers;

public sealed record ActivateDeviceRequest(string? Code, string? Platform, string? DeviceName);
public sealed record ActivateDeviceResponse(string DeviceKey);

/// <summary>
/// Exchanges the activation code IT gave the user for this device's key.
/// Exempt from DeviceControlMiddleware (the caller has no key yet), but the
/// code only works for the signed-in user it was generated for.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/device")]
public sealed class DeviceController : ControllerBase
{
    private readonly IDeviceActivationService _devices;

    public DeviceController(IDeviceActivationService devices) => _devices = devices;

    [HttpPost("activate")]
    public async Task<ActionResult<ActivateDeviceResponse>> Activate([FromBody] ActivateDeviceRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code))
            return Error("CODE_REQUIRED", "Enter the activation code from IT.");
        if (!Guid.TryParse(User.GetObjectId(), out var oid))
            return Error("CODE_INVALID", "This code isn't valid for your account.");

        var result = await _devices.ActivateAsync(oid, req.Code, req.Platform, req.DeviceName);
        return result.Outcome switch
        {
            ActivationOutcome.Activated => Ok(new ActivateDeviceResponse(result.DeviceKey!)),
            ActivationOutcome.CodeExpired => Error("CODE_EXPIRED",
                "This code has expired. Ask IT for a new one."),
            ActivationOutcome.CodeUsed => Error("CODE_USED",
                "This code has already been used. Ask IT for a new one."),
            ActivationOutcome.TooManyAttempts => Error("TOO_MANY_ATTEMPTS",
                "Too many incorrect attempts. Ask IT for a new code."),
            _ => Error("CODE_INVALID", result.AttemptsLeft > 0
                ? $"That code isn't right. Check it and try again ({result.AttemptsLeft} {(result.AttemptsLeft == 1 ? "attempt" : "attempts")} left)."
                : "That code isn't valid for your account. Check it, or ask IT for a new one."),
        };
    }

    private BadRequestObjectResult Error(string code, string message) =>
        BadRequest(new { error = new { code, message } });
}
