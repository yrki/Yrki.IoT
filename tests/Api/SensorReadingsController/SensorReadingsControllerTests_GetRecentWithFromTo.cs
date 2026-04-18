namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetRecentWithFromTo : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetRecentWithFromTo(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_readings_within_from_to_range()
    {
        // Arrange
        var t1 = new DateTimeOffset(2026, 4, 10, 10, 0, 0, TimeSpan.Zero);
        var t2 = new DateTimeOffset(2026, 4, 10, 12, 0, 0, TimeSpan.Zero);
        var t3 = new DateTimeOffset(2026, 4, 10, 14, 0, 0, TimeSpan.Zero);
        var t4 = new DateTimeOffset(2026, 4, 10, 16, 0, 0, TimeSpan.Zero);

        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 400m, t1),
            ApiTestData.CreateSensorReading("sensor-1", "co2", 500m, t2),
            ApiTestData.CreateSensorReading("sensor-1", "co2", 600m, t3),
            ApiTestData.CreateSensorReading("sensor-1", "co2", 700m, t4));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance), null!);
        var from = new DateTimeOffset(2026, 4, 10, 11, 0, 0, TimeSpan.Zero);
        var to = new DateTimeOffset(2026, 4, 10, 15, 0, 0, TimeSpan.Zero);

        // Act
        var result = await controller.GetRecent("sensor-1", 3, from, to, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var readings = Assert.IsAssignableFrom<IReadOnlyList<SensorReadingResponse>>(okResult.Value);
        Assert.Equal(2, readings.Count);
        Assert.Equal(500m, readings[0].Value);
        Assert.Equal(600m, readings[1].Value);
    }

    [Fact]
    public async Task Shall_fall_back_to_hours_when_from_to_not_provided()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "temp", 21.5m, now.AddMinutes(-30)),
            ApiTestData.CreateSensorReading("sensor-1", "temp", 22.0m, now.AddHours(-5)));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance), null!);

        // Act
        var result = await controller.GetRecent("sensor-1", 3, null, null, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var readings = Assert.IsAssignableFrom<IReadOnlyList<SensorReadingResponse>>(okResult.Value);
        Assert.Single(readings);
        Assert.Equal(21.5m, readings[0].Value);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
