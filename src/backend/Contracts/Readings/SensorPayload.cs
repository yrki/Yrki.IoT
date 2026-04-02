namespace Contracts.Readings;

public record SensorPayload(
    string PayloadHex,
    DateTimeOffset Timestamp,
    string Source = "unknown",
    string? GatewayId = null,
    int? Rssi = null);
