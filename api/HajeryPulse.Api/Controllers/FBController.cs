using HajeryPulse.Api.Models.Dto;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HajeryPulse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/fb")]
public sealed class FBController : ControllerBase
{
    private readonly IFBService _service;

    public FBController(IFBService service) => _service = service;

    [HttpGet("brands")]
    public async Task<ActionResult<IEnumerable<FBBrandDto>>> GetBrands()
        => Ok(await _service.ListBrands());

    [HttpGet("outlets")]
    public async Task<ActionResult<IEnumerable<FBOutletDto>>> GetOutlets([FromQuery] string? brand)
        => Ok(await _service.ListOutlets(brand));

    [HttpGet("summary")]
    public async Task<ActionResult<FBSummaryDto>> GetSummary([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null)
        => Ok(await _service.GetSummary(asOfDate, scopeType, scopeId));

    [HttpGet("brand-summary")]
    public async Task<ActionResult<IEnumerable<FBBrandDto>>> GetBrandSummary([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null)
        => Ok(await _service.GetBrandSummary(asOfDate, scopeType, scopeId));

    [HttpGet("aggregators")]
    public async Task<ActionResult<IEnumerable<FBAggregatorDto>>> GetAggregators([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null)
        => Ok(await _service.GetAggregators(asOfDate, scopeType, scopeId));

    [HttpGet("payments")]
    public async Task<ActionResult<IEnumerable<FBPaymentDto>>> GetPayments([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null)
        => Ok(await _service.GetPayments(asOfDate, scopeType, scopeId));

    [HttpGet("delivery-by-brand")]
    public async Task<ActionResult<IEnumerable<FBBrandDto>>> GetDeliveryByBrand([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null)
        => Ok(await _service.GetDeliveryByBrand(asOfDate, scopeType, scopeId));

    [HttpGet("top-outlets")]
    public async Task<ActionResult<IEnumerable<FBOutletDto>>> GetTopOutlets([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null, [FromQuery] int limit = 10)
        => Ok(await _service.GetTopOutlets(asOfDate, scopeType, scopeId, limit));
}
