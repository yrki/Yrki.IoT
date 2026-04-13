namespace Contracts.Requests;

public record CreateDeviceRequest(
    string UniqueId,
    string Manufacturer,
    string? Name,
    string? Type);
