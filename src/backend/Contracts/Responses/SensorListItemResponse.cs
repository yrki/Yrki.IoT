namespace Contracts.Responses;

public record SensorListItemResponse(
    Guid Id,
    string UniqueId,
    string? Name,
    string? Manufacturer,
    string Type,
    string? LocationName,
    Guid? LocationId,
    DateTimeOffset LastContact);
