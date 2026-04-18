namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetSensorsForGateway : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetSensorsForGateway(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_sensor_statistics_for_requested_gateway()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayReadings.AddRange(
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddMinutes(-30), -80),
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddMinutes(-10), -70),
            ApiTestData.CreateGatewayReading("gw-1", "sensor-2", now.AddMinutes(-5), -60),
            ApiTestData.CreateGatewayReading("gw-2", "sensor-3", now.AddMinutes(-1), -50));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance), null!);

        // Act
        var result = await controller.GetSensorsForGateway("gw-1", CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var sensors = Assert.IsAssignableFrom<IReadOnlyList<GatewaySensorResponse>>(okResult.Value);
        Assert.Equal(2, sensors.Count);

        var sensorOne = Assert.Single(sensors, s => s.SensorId == "sensor-1");
        Assert.Equal(2, sensorOne.ReadingCount);
        Assert.Equal(-75m, sensorOne.AverageRssi);

        var sensorTwo = Assert.Single(sensors, s => s.SensorId == "sensor-2");
        Assert.Equal(1, sensorTwo.ReadingCount);
        Assert.Equal(-60m, sensorTwo.AverageRssi);
    }

    [Fact]
    public async Task Shall_return_empty_list_when_gateway_has_no_readings()
    {
        // Arrange
        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance), null!);

        // Act
        var result = await controller.GetSensorsForGateway("gw-unknown", CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var sensors = Assert.IsAssignableFrom<IReadOnlyList<GatewaySensorResponse>>(okResult.Value);
        Assert.Empty(sensors);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
