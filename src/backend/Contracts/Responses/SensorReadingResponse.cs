using System;

namespace Contracts.Responses;

public record SensorReadingResponse(
    string SensorId,
    string SensorType,
    decimal Value,
    DateTimeOffset Timestamp);
