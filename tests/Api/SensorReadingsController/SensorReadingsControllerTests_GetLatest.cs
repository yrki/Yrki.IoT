namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetLatest : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetLatest(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_latest_reading_per_sensor_type()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 650m, now.AddMinutes(-10)),
            ApiTestData.CreateSensorReading("sensor-1", "co2", 710m, now.AddMinutes(-2)),
            ApiTestData.CreateSensorReading("sensor-1", "humidity", 40m, now.AddMinutes(-6)),
            ApiTestData.CreateSensorReading("sensor-1", "humidity", 42m, now.AddMinutes(-1)),
            ApiTestData.CreateSensorReading("sensor-2", "co2", 500m, now.AddMinutes(-1)));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext));

        // Act
        var result = await controller.GetLatest("sensor-1", CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var readings = Assert.IsAssignableFrom<IReadOnlyList<SensorReadingResponse>>(okResult.Value);
        Assert.Equal(2, readings.Count);
        Assert.Contains(readings, reading => reading.SensorType == "co2" && reading.Value == 710m);
        Assert.Contains(readings, reading => reading.SensorType == "humidity" && reading.Value == 42m);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
