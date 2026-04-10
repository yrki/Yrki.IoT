namespace Contracts.Responses;

public record LocationResponse(
    Guid Id,
    string Name,
    string Description,
    int DeviceCount,
    Guid? ParentLocationId,
    double? Latitude,
    double? Longitude,
    double[][]? Boundary,
    string? Color);
