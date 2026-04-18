namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetCoverage : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetCoverage(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_coverage_connections_grouped_by_gateway_and_sensor()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayReadings.AddRange(
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddHours(-2), -70),
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddHours(-1), -60),
            ApiTestData.CreateGatewayReading("gw-1", "sensor-2", now.AddMinutes(-30), -80),
            ApiTestData.CreateGatewayReading("gw-2", "sensor-1", now.AddMinutes(-15), -55));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance), null!);

        // Act
        var result = await controller.GetCoverage(168, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var connections = Assert.IsAssignableFrom<IReadOnlyList<CoverageConnectionResponse>>(okResult.Value);
        Assert.Equal(3, connections.Count);

        var gw1sensor1 = Assert.Single(connections, c => c.GatewayId == "gw-1" && c.SensorId == "sensor-1");
        Assert.Equal(2, gw1sensor1.ReadingCount);
        Assert.NotNull(gw1sensor1.AverageRssi);

        var gw1sensor2 = Assert.Single(connections, c => c.GatewayId == "gw-1" && c.SensorId == "sensor-2");
        Assert.Equal(1, gw1sensor2.ReadingCount);

        var gw2sensor1 = Assert.Single(connections, c => c.GatewayId == "gw-2" && c.SensorId == "sensor-1");
        Assert.Equal(1, gw2sensor1.ReadingCount);
    }

    [Fact]
    public async Task Shall_return_empty_list_when_no_gateway_readings_exist()
    {
        // Arrange
        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance), null!);

        // Act
        var result = await controller.GetCoverage(168, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var connections = Assert.IsAssignableFrom<IReadOnlyList<CoverageConnectionResponse>>(okResult.Value);
        Assert.Empty(connections);
    }

    [Fact]
    public async Task Shall_compute_average_rssi_only_from_recent_readings()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayReadings.AddRange(
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddHours(-1), -60),
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddDays(-30), -90));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance), null!);

        // Act
        var result = await controller.GetCoverage(24, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var connections = Assert.IsAssignableFrom<IReadOnlyList<CoverageConnectionResponse>>(okResult.Value);
        var connection = Assert.Single(connections);
        Assert.Equal(2, connection.ReadingCount);
        Assert.Equal(-60.0, connection.AverageRssi);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
