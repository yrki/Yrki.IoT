namespace Contracts.Readings;

public record SensorReadingReceived(
    string SensorId,
    string SensorType,
    string? Manufacturer,
    decimal Value,
    DateTimeOffset Timestamp);
