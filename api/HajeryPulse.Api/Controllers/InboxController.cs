using System.Xml;
using HajeryPulse.Api.Models.Dto;
using HajeryPulse.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HajeryPulse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/inbox")]
public sealed class InboxController : ControllerBase
{
    private readonly IInboxService _service;

    public InboxController(IInboxService service) => _service = service;

 
/* 
    [HttpGet("users")]
    public async Task<ActionResult<List<UserDto>>> GetUsers()
    {
        return Ok(await _service.GetUsers());
    }
    [HttpGet("requests")]
public async Task<ActionResult<InboxListResponse>> ListRequests()
 
{
    return Ok(await _service.ListRequests());
} */

   /*  [HttpPost("{id}/approve")]
    [Authorize(Policy = "ApproveLpo")]
    public async Task<ActionResult<ApprovalActionResponse>> Approve(
        [FromRoute] string id, [FromBody] ApprovalActionRequest req)
        => Ok(await _service.Approve(User, id, req.Comment));

    [HttpPost("{id}/reject")]
    [Authorize(Policy = "ApproveLpo")]
    public async Task<ActionResult<ApprovalActionResponse>> Reject(
        [FromRoute] string id, [FromBody] ApprovalActionRequest req)
        => Ok(await _service.Reject(User, id, req.Comment));

    [HttpPost("{id}/clarify")]
    public async Task<ActionResult<ApprovalActionResponse>> Clarify(
        [FromRoute] string id, [FromBody] ApprovalClarifyRequest req)
        => Ok(await _service.Clarify(User, id, req.Question));  */
}
