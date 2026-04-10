namespace Contracts.Requests;

public record CreateLocationRequest(
    string Name,
    string? Description,
    Guid? ParentLocationId,
    double? Latitude,
    double? Longitude,
    double[][]? Boundary,
    string? Color);
