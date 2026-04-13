namespace Contracts.Responses;

public record BimStructureDiffResponse(
    IReadOnlyList<BimDiffFloor> NewFloors,
    IReadOnlyList<BimDiffFloor> RemovedFloors,
    IReadOnlyList<BimDiffRoom> NewRooms,
    IReadOnlyList<BimDiffRoom> RemovedRooms,
    bool HasChanges);

public record BimDiffFloor(
    Guid? ExistingId,
    string Name,
    double Elevation,
    int? BimExpressId,
    int RoomCount);

public record BimDiffRoom(
    Guid? ExistingId,
    string Name,
    string? Number,
    int? BimExpressId,
    string FloorName,
    int DeviceCount);
