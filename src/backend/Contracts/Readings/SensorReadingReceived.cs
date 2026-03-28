using System;

namespace Contracts.Readings;

public record SensorReadingReceived(
    string SensorId,
    string SensorType,
    decimal Value,
    DateTimeOffset Timestamp);
