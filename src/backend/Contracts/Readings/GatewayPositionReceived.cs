namespace Contracts.Readings;

public record GatewayPositionReceived(
    string GatewayId,
    DateTimeOffset Timestamp,
    double? Longitude = null,
    double? Latitude = null,
    double? Heading = null,
    bool DriveBy = false);
