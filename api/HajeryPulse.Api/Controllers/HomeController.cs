using HajeryPulse.Api.Models.Dto;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HajeryPulse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/home")]
public sealed class HomeController : ControllerBase
{
    private readonly IHomeService _service;

    public HomeController(IHomeService service) => _service = service;

    [HttpGet("revenue-summary")]
    public async Task<ActionResult<HomeDto>> GetRevenueSummary(
        [FromQuery] string asOfDate, [FromQuery] string period = "week")
        => Ok(await _service.GetCombinedRevenue(asOfDate, period));


        [HttpGet("quick-kpis")]
public async Task<ActionResult<HomeQuickKpisDto>> GetQuickKpis([FromQuery] string asOfDate)
    => Ok(await _service.GetQuickKpis(asOfDate));
}