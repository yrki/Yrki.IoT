namespace Contracts.Responses;

public record CoverageConnectionResponse(
    string GatewayId,
    string SensorId,
    double? AverageRssi,
    int ReadingCount,
    DateTimeOffset LastSeenAt);
