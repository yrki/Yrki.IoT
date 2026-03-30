namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetRecent : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetRecent(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_only_recent_readings_for_requested_sensor()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 700m, now.AddMinutes(-30)),
            ApiTestData.CreateSensorReading("sensor-1", "co2", 650m, now.AddHours(-5)),
            ApiTestData.CreateSensorReading("sensor-2", "co2", 800m, now.AddMinutes(-20)));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext));

        // Act
        var result = await controller.GetRecent("sensor-1", 3, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var readings = Assert.IsAssignableFrom<IReadOnlyList<SensorReadingResponse>>(okResult.Value);
        var reading = Assert.Single(readings);
        Assert.Equal("sensor-1", reading.SensorId);
        Assert.Equal(700m, reading.Value);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
