namespace Contracts.Requests;

public record CreateBuildingRequest(
    string Name,
    string? Address,
    double? Latitude,
    double? Longitude);
