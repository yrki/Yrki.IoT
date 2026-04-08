namespace Contracts.Requests;

public record UpdateDeviceRequest(
    string? Name,
    string? Description,
    Guid? LocationId,
    double? Latitude,
    double? Longitude);
