namespace Contracts.Requests;

public record UpdateLocationRequest(string? Name, string? Description, Guid? ParentLocationId, double? Latitude, double? Longitude);
