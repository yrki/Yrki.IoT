namespace Contracts.Requests;

public record ImportBuildingStructureRequest(
    IReadOnlyList<ImportFloorEntry> Floors);

public record ImportFloorEntry(
    string Name,
    double Elevation,
    int? BimExpressId,
    IReadOnlyList<ImportRoomEntry> Rooms);

public record ImportRoomEntry(
    string Name,
    string? Number,
    int? BimExpressId);
