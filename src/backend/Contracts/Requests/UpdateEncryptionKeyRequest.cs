namespace Contracts.Requests;

public record UpdateEncryptionKeyRequest(
    string? DeviceUniqueId,
    string? GroupName,
    string? KeyValue,
    string? Description);
