namespace Contracts.Responses;

public record EncryptionKeyResponse(
    Guid Id,
    string? Manufacturer,
    string? DeviceUniqueId,
    string? GroupName,
    string? Description,
    string? KeyValue,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);
