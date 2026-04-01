namespace Contracts.Requests;

public record CreateEncryptionKeyRequest(
    string? Manufacturer,
    string? DeviceUniqueId,
    string? GroupName,
    string KeyValue,
    string? Description);
