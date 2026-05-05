using HajeryPulse.Api.Models.Dto;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HajeryPulse.Api.Controllers;

[ApiController]
[Authorize(Policy = "ViewSales")]
[Route("api/v1/sales/wt")]
public sealed class SalesController : ControllerBase
{
    private readonly ISalesService _service;

    public SalesController(ISalesService service) => _service = service;

    [HttpGet("summary")]
    public async Task<ActionResult<WTSummaryDto>> GetSummary([FromQuery] string asOfDate, [FromQuery] string bt = "both")
        => Ok(await _service.GetSummary(asOfDate, bt));

    [HttpGet("margin")]
    public async Task<ActionResult<MarginAnalysisDto>> GetMargin([FromQuery] string asOfDate, [FromQuery] string bt = "both")
        => Ok(await _service.GetMargin(asOfDate, bt));

    [HttpGet("quality")]
    public async Task<ActionResult<SalesQualityDto>> GetQuality([FromQuery] string asOfDate, [FromQuery] string bt = "both")
        => Ok(await _service.GetQuality(asOfDate, bt));

    [HttpGet("org")]
    public async Task<ActionResult<OrgNodeDto>> GetOrg([FromQuery] string asOfDate, [FromQuery] string bt = "both", [FromQuery] string parent = "root")
        => Ok(await _service.GetOrgNode(asOfDate, bt, parent));

    [HttpGet("top-brands")]
    public async Task<ActionResult<IEnumerable<TopBrandDto>>> GetTopBrands([FromQuery] string asOfDate, [FromQuery] string bt = "both", [FromQuery] int limit = 10)
        => Ok(await _service.GetTopBrands(asOfDate, bt, limit));

    [HttpGet("top-customers")]
    public async Task<ActionResult<IEnumerable<TopCustomerDto>>> GetTopCustomers([FromQuery] string asOfDate, [FromQuery] string bt = "both", [FromQuery] int limit = 10)
        => Ok(await _service.GetTopCustomers(asOfDate, bt, limit));
}
