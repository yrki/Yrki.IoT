using System;

namespace Contracts.Readings;

public record SensorPayload(
    byte[] RawMessage,
    DateTimeOffset Timestamp);
