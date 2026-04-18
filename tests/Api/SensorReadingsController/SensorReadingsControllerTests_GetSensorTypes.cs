namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetSensorTypes : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetSensorTypes(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_all_distinct_sensor_types()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 650m, now.AddMinutes(-10)),
            ApiTestData.CreateSensorReading("sensor-1", "humidity", 40m, now.AddMinutes(-5)),
            ApiTestData.CreateSensorReading("sensor-2", "co2", 500m, now.AddMinutes(-3)),
            ApiTestData.CreateSensorReading("sensor-2", "temperature", 22m, now.AddMinutes(-1)));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext), null!);

        // Act
        var result = await controller.GetSensorTypes(null, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var types = Assert.IsAssignableFrom<IReadOnlyList<string>>(okResult.Value);
        Assert.Equal(3, types.Count);
        Assert.Contains("co2", types);
        Assert.Contains("humidity", types);
        Assert.Contains("temperature", types);
    }

    [Fact]
    public async Task Shall_filter_sensor_types_by_sensor_ids()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-1", "co2", 650m, now.AddMinutes(-10)),
            ApiTestData.CreateSensorReading("sensor-1", "humidity", 40m, now.AddMinutes(-5)),
            ApiTestData.CreateSensorReading("sensor-2", "temperature", 22m, now.AddMinutes(-1)));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext), null!);

        // Act
        var result = await controller.GetSensorTypes("sensor-1", CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var types = Assert.IsAssignableFrom<IReadOnlyList<string>>(okResult.Value);
        Assert.Equal(2, types.Count);
        Assert.Contains("co2", types);
        Assert.Contains("humidity", types);
        Assert.DoesNotContain("temperature", types);
    }

    [Fact]
    public async Task Shall_return_empty_list_when_no_readings_exist()
    {
        // Arrange
        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext), null!);

        // Act
        var result = await controller.GetSensorTypes(null, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var types = Assert.IsAssignableFrom<IReadOnlyList<string>>(okResult.Value);
        Assert.Empty(types);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
