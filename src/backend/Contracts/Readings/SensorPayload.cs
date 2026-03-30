namespace Contracts.Readings;

public record SensorPayload(
    string PayloadHex,
    DateTimeOffset Timestamp);
