namespace Contracts.Mqtt;

/// <summary>
/// MQTT payload for raw WMBus telegrams.
///
/// Topic: wmbus/raw
///
/// Example:
/// {
///   "payloadHex": "2E449344...",
///   "gatewayId": "gw-001",
///   "rssi": -65,
///   "timestamp": "2026-04-01T12:00:00Z"
/// }
/// </summary>
public record WMBusMqttMessage(
    string PayloadHex,
    string? GatewayId = null,
    int? Rssi = null,
    DateTimeOffset? Timestamp = null);
