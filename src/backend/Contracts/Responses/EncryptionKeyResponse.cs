namespace Contracts.Responses;

public record EncryptionKeyResponse(
    Guid Id,
    string? Manufacturer,
    string? DeviceUniqueId,
    string? GroupName,
    string? Description,
    string? KeyValue,
    bool HasKey,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);
