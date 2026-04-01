namespace Contracts.Responses;

public record SensorGatewayResponse(
    string GatewayId,
    int ReadingCount,
    decimal AverageRssi,
    DateTimeOffset LastSeenAt);
