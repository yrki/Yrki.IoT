namespace Core.Features.SensorData.Query;

public record SensorReadingQuery(
    string SensorId,
    int Hours = 3,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null);
