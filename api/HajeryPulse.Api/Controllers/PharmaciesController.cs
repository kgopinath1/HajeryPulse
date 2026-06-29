using HajeryPulse.Api.Models.Dto;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HajeryPulse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/pharma")]
public sealed class PharmaciesController : ControllerBase
{
    private readonly IPharmaService _service;

    public PharmaciesController(IPharmaService service) => _service = service;

    [HttpGet("list")]
    public async Task<ActionResult<IEnumerable<PharmacyDto>>> GetList()
        => Ok(await _service.ListPharmacies());

    [HttpGet("summary")]
    public async Task<ActionResult<PharmaSummaryDto>> GetSummary([FromQuery] string asOfDate, [FromQuery] string pharmacyId = "all", [FromQuery] string period = "week"
    )
        => Ok(await _service.GetSummary(asOfDate, pharmacyId, period));

    [HttpGet("trends")]
    public async Task<ActionResult<IEnumerable<PharmaTrendDto>>> GetTrend([FromQuery] string asOfDate, [FromQuery] string pharmacyId = "all", [FromQuery] string period = "week")
        => Ok(await _service.GetTrend(asOfDate, pharmacyId, period));

    [HttpGet("margin")]
    public async Task<ActionResult<PharmaMarginDto>> GetMargin([FromQuery] string asOfDate, [FromQuery] string pharmacyId = "all", [FromQuery] string period = "week")
        => Ok(await _service.GetMargin(asOfDate, pharmacyId,period));

    [HttpGet("quality")]
    public async Task<ActionResult<PharmaSalesQualityDto>> GetQuality([FromQuery] string asOfDate, [FromQuery] string pharmacyId = "all", [FromQuery] string period = "week")
        => Ok(await _service.GetQuality(asOfDate, pharmacyId, period));

    [HttpGet("channels")]
    public async Task<ActionResult<PharmaChannelDto>> GetChannels([FromQuery] string asOfDate, [FromQuery] string pharmacyId = "all", [FromQuery] string period = "week")
        => Ok(await _service.GetChannels(asOfDate, pharmacyId, period));

    [HttpGet("payments")]
    public async Task<ActionResult<IEnumerable<PharmaPaymentDto>>> GetPayments([FromQuery] string asOfDate, [FromQuery] string pharmacyId = "all", [FromQuery] string period = "week")
        => Ok(await _service.GetPayments(asOfDate, pharmacyId, period));

    [HttpGet("categories")]
    public async Task<ActionResult<IEnumerable<PharmaCategoryDto>>> GetCategories([FromQuery] string asOfDate, [FromQuery] string pharmacyId = "all", [FromQuery] int limit = 10,[FromQuery] string period = "week")
        => Ok(await _service.GetCategories(asOfDate, pharmacyId, limit,period));

    [HttpGet("rx-otc-mix")]
    public async Task<ActionResult<PharmaRxOtcMixDto>> GetRxMix([FromQuery] string asOfDate, [FromQuery] string pharmacyId = "all", [FromQuery] string period = "week")
        => Ok(await _service.GetRxOtcMix(asOfDate, pharmacyId, period));

    [HttpGet("discount-leaderboard")]
    public async Task<ActionResult<IEnumerable<PharmaDiscountDto>>> GetDiscount([FromQuery] string asOfDate, [FromQuery] int limit = 10,[FromQuery] string period = "week")
        => Ok(await _service.GetDiscountLeaderboard(asOfDate, limit, period));

    [HttpGet("top")]
    public async Task<ActionResult<IEnumerable<PharmacyDto>>> GetTop([FromQuery] string asOfDate,[FromQuery] int limit = 10, [FromQuery] string period = "week")
        => Ok(await _service.GetTopPharmacies(asOfDate,limit,period));
}
