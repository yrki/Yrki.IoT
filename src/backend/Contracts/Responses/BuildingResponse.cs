namespace Contracts.Responses;

public record BuildingResponse(
    Guid Id,
    string Name,
    string? Address,
    double? Latitude,
    double? Longitude,
    string? IfcFileName,
    int DeviceCount,
    Guid? LocationId,
    string? LocationName,
    DateTimeOffset CreatedAtUtc);
