namespace Contracts.Responses;

public record BuildingDeviceResponse(
    Guid Id,
    string UniqueId,
    string? Name,
    string? Manufacturer,
    string Type,
    string Kind,
    DateTimeOffset LastContact,
    double? BimX,
    double? BimY,
    double? BimZ,
    Guid? RoomId);
