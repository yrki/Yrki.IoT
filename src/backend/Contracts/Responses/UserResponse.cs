namespace Contracts.Responses;

public record UserResponse(
    Guid Id,
    string Email,
    DateTime CreatedAtUtc,
    DateTime? LastLoginAtUtc);
