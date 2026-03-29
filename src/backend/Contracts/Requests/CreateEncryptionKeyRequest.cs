namespace Contracts.Requests;

public record CreateEncryptionKeyRequest(
    string? DeviceUniqueId,
    string? GroupName,
    string KeyValue,
    string? Description);
