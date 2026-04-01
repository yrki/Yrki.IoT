namespace Contracts.Responses;

public record GatewaySensorResponse(
    string SensorId,
    int ReadingCount,
    decimal AverageRssi,
    DateTimeOffset LastSeenAt);
