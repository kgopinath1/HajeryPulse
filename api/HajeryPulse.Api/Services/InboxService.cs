using System.Security.Claims;
using HajeryPulse.Api.Data.Repositories;
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Services;

public interface IInboxService
{
    Task<List<UserDto>> GetUsers();
/* 
    Task<ApprovalDetailDto>      ListRequests();
    Task<ApprovalActionResponse> Approve(ClaimsPrincipal user, string id, string comment);
    Task<ApprovalActionResponse> Reject (ClaimsPrincipal user, string id, string comment);
    Task<ApprovalActionResponse> Clarify(ClaimsPrincipal user, string id, string question);  */
}

public sealed class InboxService : IInboxService
{
    private readonly IInboxRepository _repo;
    //private readonly ICacheService _cache;
    private readonly ILogger<InboxService> _logger;

    //public InboxService(IInboxRepository repo, ICacheService cache, ILogger<InboxService> logger)
    //{
    //    _repo   = repo;
    //    _cache  = cache;
    //    _logger = logger;
    //}
    public InboxService(IInboxRepository repo, ILogger<InboxService> logger)
    {
        _repo = repo;
      //  _cache = cache;
        _logger = logger;
    }

 public async Task<List<UserDto>> GetUsers()
{
    var users = await _repo.GetUsers();
    return users.ToList();
}


/*     public async Task<InboxListResponse> ListRequests()
{
    var items = await _repo.ListRequests();

    return new InboxListResponse(items.ToList());
} */
/*
    public Task<ApprovalDetailDto> GetDetail(ClaimsPrincipal user, string id)
        => _repo.GetDetail(UserId(user), id);

    public async Task<ApprovalActionResponse> Approve(ClaimsPrincipal user, string id, string comment)
    {
        var userId = UserId(user);
        var result = await _repo.Approve(userId, id, comment);

       // await _cache.RemoveAsync("hp:inbox:list");
        _logger.LogInformation("User {UserId} approved {RequestId}", userId, id);
        return result;
    }

    public async Task<ApprovalActionResponse> Reject(ClaimsPrincipal user, string id, string comment)
    {
        var userId = UserId(user);
        var result = await _repo.Reject(userId, id, comment);
      //  await _cache.RemoveAsync("hp:inbox:list");
        _logger.LogInformation("User {UserId} rejected {RequestId}", userId, id);
        return result;
    }

    public async Task<ApprovalActionResponse> Clarify(ClaimsPrincipal user, string id, string question)
    {
        var userId = UserId(user);
        var result = await _repo.Clarify(userId, id, question);
        _logger.LogInformation("User {UserId} requested clarification for {RequestId}", userId, id);
        return result;
    }

    private static string UserId(ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new UnauthorizedAccessException("Missing user id"); */
}
