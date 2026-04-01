namespace Contracts.Requests;

public record UpdateEncryptionKeyRequest(
    string? Manufacturer,
    string? DeviceUniqueId,
    string? GroupName,
    string? KeyValue,
    string? Description);
