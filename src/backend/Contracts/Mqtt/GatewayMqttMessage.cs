namespace Contracts.Mqtt;

/// <summary>
/// MQTT payload for gateway position reports.
///
/// Topic: gateway/position
///
/// Example:
/// {
///   "gatewayId": "gw-001",
///   "timestamp": "2026-04-01T12:00:00Z",
///   "lon": 10.7522,
///   "lat": 59.9139,
///   "heading": 45.0,
///   "driveBy": true
/// }
/// </summary>
public record GatewayMqttMessage(
    string GatewayId,
    DateTimeOffset Timestamp,
    double? Lon = null,
    double? Lat = null,
    double? Heading = null,
    bool DriveBy = false);
