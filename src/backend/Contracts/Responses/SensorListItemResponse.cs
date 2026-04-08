namespace Contracts.Responses;

public record SensorListItemResponse(
    Guid Id,
    string UniqueId,
    string? Name,
    string? Manufacturer,
    string Type,
    string Kind,
    string? LocationName,
    Guid? LocationId,
    DateTimeOffset LastContact,
    DateTimeOffset InstallationDate,
    double? Latitude,
    double? Longitude);
