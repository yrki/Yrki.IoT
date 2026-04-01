namespace Contracts.Readings;

public record SensorPayload(
    string PayloadHex,
    DateTimeOffset Timestamp,
    string Source = "serial",
    string? GatewayId = null,
    int? Rssi = null);
