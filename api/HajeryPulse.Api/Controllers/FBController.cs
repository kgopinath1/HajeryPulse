using HajeryPulse.Api.Models.Dto;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog.Core;

namespace HajeryPulse.Api.Controllers;

[ApiController]
[Authorize]

//[AllowAnonymous]

[Route("api/v1/fb")]
public sealed class FBController : ControllerBase
{
    private readonly IFBService _service;

    public FBController(IFBService service) => _service = service;

    [HttpGet("brands")]
    public async Task<ActionResult<IEnumerable<FBBrandDto>>> GetBrands([FromQuery] string asOfDate, [FromQuery] string period = "week")
        => Ok(await _service.ListBrands(asOfDate,  period));

    [HttpGet("outlets")]
    public async Task<ActionResult<IEnumerable<FBOutletDto>>> GetOutlets([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null, [FromQuery] string period = "week")
        => Ok(await _service.ListOutlets(asOfDate, scopeType, scopeId, period));

    [HttpGet("summary")]
    public async Task<ActionResult<FBSummaryDto>> GetSummary([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null, [FromQuery] string period = "week")
        => Ok(await _service.GetSummary(asOfDate, scopeType, scopeId,period));


    //[HttpGet("brand-summary")]
    //public async Task<ActionResult<IEnumerable<FBBrandDto>>> GetBrandSummary([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null, [FromQuery] string period = "week")
    //    => Ok(await _service.GetBrandSummary(asOfDate, scopeType, scopeId, period));

    [HttpGet("brand-summary")]
    public async Task<ActionResult<IEnumerable<FBBrandDto>>> GetBrandSummary(
    [FromQuery] string asOfDate,
    [FromQuery] string scopeType = "all",
    [FromQuery] string? scopeId = null,
    [FromQuery] string period = "week")
    {
        try
        {
            Console.WriteLine($"asOfDate: {asOfDate}");
            Console.WriteLine($"scopeType: {scopeType}");
            Console.WriteLine($"scopeId: {scopeId}");
            Console.WriteLine($"period: {period}");

            var result = await _service.GetBrandSummary(
                asOfDate,
                scopeType,
                scopeId,
                period
            );

            Console.WriteLine($"Brand Count: {result?.Count()}");

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine("BRAND SUMMARY ERROR:");
            Console.WriteLine(ex.ToString());

            return StatusCode(500, ex.ToString());
        }
    }


    [HttpGet("aggregators")]
    public async Task<ActionResult<IEnumerable<FBAggregatorDto>>> GetAggregators([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null,[FromQuery] string period = "week")
        => Ok(await _service.GetAggregators(asOfDate, scopeType, scopeId, period));

    [HttpGet("payments")]
    public async Task<ActionResult<IEnumerable<FBPaymentDto>>> GetPayments([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null,[FromQuery] string period = "week")
        => Ok(await _service.GetPayments(asOfDate, scopeType, scopeId, period));
        
[HttpGet("channels")]
public async Task<ActionResult<IEnumerable<FBChannelMixDto>>> GetChannels(
    [FromQuery] string asOfDate,
    [FromQuery] string scopeType = "all",
    [FromQuery] string? scopeId = null,
    [FromQuery] string period = "week")
{
    return Ok(
        await _service.GetChannels(
            asOfDate,
            scopeType,
            scopeId,
            period));
}
    [HttpGet("delivery-by-brand")]
    public async Task<ActionResult<IEnumerable<FBBrandDto>>> GetDeliveryByBrand([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null,[FromQuery] string period = "week")
        => Ok(await _service.GetDeliveryByBrand(asOfDate, scopeType, scopeId,period));

    [HttpGet("top-outlets")]
    public async Task<ActionResult<IEnumerable<FBOutletDto>>> GetTopOutlets([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null, [FromQuery] string period = "week",[FromQuery] int limit = 10)
        => Ok(await _service.GetTopOutlets(asOfDate, scopeType, scopeId, period, limit));

    [HttpGet("trends")]
    public async Task<ActionResult<IEnumerable<FBTrendDto>>> GetTrend([FromQuery] string asOfDate, [FromQuery] string scopeType = "all", [FromQuery] string? scopeId = null, [FromQuery] string period = "week")
        => Ok(await _service.GetTrend(asOfDate, scopeType, scopeId, period));
}
