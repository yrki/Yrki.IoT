namespace Contracts.Responses;

public record SensorReadingResponse(
    string SensorId,
    string SensorType,
    decimal Value,
    DateTimeOffset Timestamp,
    string? GatewayId,
    int? Rssi);
