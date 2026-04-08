namespace Contracts.Responses;

public record NewDeviceResponse(
    Guid Id,
    string UniqueId,
    string? Name,
    string? Manufacturer,
    string Type,
    string Description,
    Guid? LocationId,
    DateTimeOffset LastContact,
    DateTimeOffset InstallationDate,
    double? Latitude,
    double? Longitude);
