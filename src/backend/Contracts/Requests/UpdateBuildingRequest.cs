namespace Contracts.Requests;

public record UpdateBuildingRequest(
    string? Name,
    string? Address,
    double? Latitude,
    double? Longitude,
    Guid? LocationId);
