using HajeryPulse.Api.Auth;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HajeryPulse.Api.Controllers;

public sealed record BlacklistRequest(string? Reason);

[ApiController]
[Authorize]
[AdminApiKey]
[Route("api/v1/admin/devices")]
public sealed class AdminDevicesController : ControllerBase
{
    private readonly IDeviceRegistryService _registry;

    public AdminDevicesController(IDeviceRegistryService registry) => _registry = registry;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<DeviceRecord>>> List()
        => Ok(await _registry.ListAsync());

    [HttpPost("{deviceId}/approve")]
    public async Task<ActionResult<DeviceRecord>> Approve(string deviceId)
        => Ok(await _registry.ApproveAsync(deviceId));

    [HttpPost("{deviceId}/blacklist")]
    public async Task<ActionResult<DeviceRecord>> Blacklist(string deviceId, [FromBody] BlacklistRequest? req)
        => Ok(await _registry.BlacklistAsync(deviceId, req?.Reason));

    [HttpPost("{deviceId}/unblacklist")]
    public async Task<IActionResult> Unblacklist(string deviceId)
        => await _registry.UnblacklistAsync(deviceId) ? Ok(new { deviceId, blacklisted = false }) : NotFound();
}
