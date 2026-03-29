namespace Contracts.Responses;

public record EncryptionKeyResponse(
    Guid Id,
    string? DeviceUniqueId,
    string? GroupName,
    string? Description,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);
