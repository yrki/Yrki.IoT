namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_Export : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_Export(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_readings_within_time_range()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 500m, now.AddHours(-5)),
            ApiTestData.CreateSensorReading("sensor-1", "co2", 600m, now.AddHours(-3)),
            ApiTestData.CreateSensorReading("sensor-1", "co2", 700m, now.AddHours(-1)),
            ApiTestData.CreateSensorReading("sensor-1", "co2", 800m, now.AddHours(1)));
        await _dbContext.SaveChangesAsync();

        var request = new ExportReadingsRequest(null, null, now.AddHours(-4), now);
        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext), null!);

        // Act
        var result = await controller.Export(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var readings = Assert.IsAssignableFrom<IReadOnlyList<SensorReadingResponse>>(okResult.Value);
        Assert.Equal(2, readings.Count);
        Assert.All(readings, r => Assert.Equal("sensor-1", r.SensorId));
    }

    [Fact]
    public async Task Shall_filter_by_sensor_ids()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 500m, now.AddHours(-2)),
            ApiTestData.CreateSensorReading("sensor-2", "co2", 600m, now.AddHours(-2)),
            ApiTestData.CreateSensorReading("sensor-3", "co2", 700m, now.AddHours(-2)));
        await _dbContext.SaveChangesAsync();

        var request = new ExportReadingsRequest(["sensor-1", "sensor-3"], null, now.AddHours(-3), now);
        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext), null!);

        // Act
        var result = await controller.Export(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var readings = Assert.IsAssignableFrom<IReadOnlyList<SensorReadingResponse>>(okResult.Value);
        Assert.Equal(2, readings.Count);
        Assert.Contains(readings, r => r.SensorId == "sensor-1");
        Assert.Contains(readings, r => r.SensorId == "sensor-3");
        Assert.DoesNotContain(readings, r => r.SensorId == "sensor-2");
    }

    [Fact]
    public async Task Shall_filter_by_sensor_types()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 500m, now.AddHours(-2)),
            ApiTestData.CreateSensorReading("sensor-1", "humidity", 40m, now.AddHours(-2)),
            ApiTestData.CreateSensorReading("sensor-1", "temperature", 22m, now.AddHours(-2)));
        await _dbContext.SaveChangesAsync();

        var request = new ExportReadingsRequest(null, ["co2", "temperature"], now.AddHours(-3), now);
        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext), null!);

        // Act
        var result = await controller.Export(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var readings = Assert.IsAssignableFrom<IReadOnlyList<SensorReadingResponse>>(okResult.Value);
        Assert.Equal(2, readings.Count);
        Assert.Contains(readings, r => r.SensorType == "co2");
        Assert.Contains(readings, r => r.SensorType == "temperature");
        Assert.DoesNotContain(readings, r => r.SensorType == "humidity");
    }

    [Fact]
    public async Task Shall_return_empty_list_when_no_readings_match()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.Add(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 500m, now.AddHours(-10)));
        await _dbContext.SaveChangesAsync();

        var request = new ExportReadingsRequest(null, null, now.AddHours(-2), now);
        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext), null!);

        // Act
        var result = await controller.Export(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var readings = Assert.IsAssignableFrom<IReadOnlyList<SensorReadingResponse>>(okResult.Value);
        Assert.Empty(readings);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
