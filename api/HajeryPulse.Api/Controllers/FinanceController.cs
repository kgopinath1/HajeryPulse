using HajeryPulse.Api.Models.Dto;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HajeryPulse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/finance")]
public sealed class FinanceController : ControllerBase
{
    private readonly IFinanceService _service;

    public FinanceController(IFinanceService service) => _service = service;

    [HttpGet("health")]
    public async Task<ActionResult<FinanceHealthDto>> GetHealth([FromQuery] string asOfDate)
        => Ok(await _service.GetHealth(asOfDate));

    [HttpGet("ops")]
    public async Task<ActionResult<OpsSummaryDto>> GetOps([FromQuery] string asOfDate)
        => Ok(await _service.GetOps(asOfDate));
}
