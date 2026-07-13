
using HajeryPulse.Api.Models.Dto;

namespace HajeryPulse.Api.Data.Repositories;

public interface IInboxRepository
{
    Task<IEnumerable<UserDto>> GetUsers();
    


   // Task<IEnumerable<ApprovalSummaryDto>> ListInbox(string status, string comment, string userid);
    // Task<ApprovalDetailDto>               ListRequests();
    /* Task<ApprovalActionResponse>          Approve(string userId, string requestId, string comment);
    Task<ApprovalActionResponse>          Reject (string userId, string requestId, string comment);
    Task<ApprovalActionResponse>          Clarify(string userId, string requestId, string question);  */
}

public sealed class InboxRepository : IInboxRepository
{
    private readonly HttpClient _httpClient;
    public InboxRepository(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

public async Task<IEnumerable<UserDto>> GetUsers()
{
    var response = await _httpClient.GetAsync("api/users");
    response.EnsureSuccessStatusCode();

    var users = await response.Content.ReadFromJsonAsync<List<UserDto>>();
    return users ?? new List<UserDto>();
}
/*     public async Task<IEnumerable<ApprovalSummaryDto>> ListRequests()
{
    var response = await _httpClient.GetAsync("api/requests");

    response.EnsureSuccessStatusCode();

    return await response.Content.ReadFromJsonAsync<List<ApprovalSummaryDto>>()
           ?? Enumerable.Empty<ApprovalSummaryDto>();
} */

 /*    public async Task<ApprovalDetailDto> GetDetail(string userId, string requestId)
{
    var response = await _httpClient.GetAsync($"inbox/{requestId}?userId={userId}");
    response.EnsureSuccessStatusCode();

    return await response.Content.ReadFromJsonAsync<ApprovalDetailDto>();
}


    public async Task<ApprovalActionResponse> Approve(string userId, string requestId, string comment)
{
    var response = await _httpClient.PostAsJsonAsync("inbox/approve",
        new { userId, requestId, comment });

    response.EnsureSuccessStatusCode();

    return await response.Content.ReadFromJsonAsync<ApprovalActionResponse>();
}
    public async Task<ApprovalActionResponse> Reject(string userId, string requestId, string comment)
{
    var response = await _httpClient.PostAsJsonAsync("inbox/reject",
        new { userId, requestId, comment });

    response.EnsureSuccessStatusCode();

    return await response.Content.ReadFromJsonAsync<ApprovalActionResponse>();
}
   public async Task<ApprovalActionResponse> Clarify(string userId, string requestId, string question)
{
    var response = await _httpClient.PostAsJsonAsync("inbox/clarify",
        new { userId, requestId, question });

    response.EnsureSuccessStatusCode();

    return await response.Content.ReadFromJsonAsync<ApprovalActionResponse>();
}  */
}
