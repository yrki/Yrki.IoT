namespace Contracts.Responses;

public record FloorResponse(
    Guid Id,
    string Name,
    double Elevation,
    int SortOrder,
    int? BimExpressId,
    Guid BuildingId,
    IReadOnlyList<RoomResponse> Rooms);

public record RoomResponse(
    Guid Id,
    string Name,
    string? Number,
    int SortOrder,
    int? BimExpressId,
    Guid FloorId,
    int DeviceCount);
