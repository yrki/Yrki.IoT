namespace Core.Features.SensorData.Query;

public record SensorReadingQuery(string SensorId, int Hours = 3);
