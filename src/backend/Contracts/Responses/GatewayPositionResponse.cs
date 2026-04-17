namespace Contracts.Responses;

public record GatewayPositionResponse(
    DateTimeOffset Timestamp,
    string GatewayUniqueId,
    double? Longitude,
    double? Latitude,
    double? Heading,
    bool DriveBy);
