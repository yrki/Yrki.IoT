namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetGateways : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetGateways(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_gateway_statistics_for_requested_sensor()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayReadings.AddRange(
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddMinutes(-30), -80),
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddMinutes(-10), -70),
            ApiTestData.CreateGatewayReading("gw-2", "sensor-1", now.AddMinutes(-5), -60),
            ApiTestData.CreateGatewayReading("gw-9", "sensor-2", now.AddMinutes(-1), -50));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext));

        // Act
        var result = await controller.GetGateways("sensor-1", null, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var gateways = Assert.IsAssignableFrom<IReadOnlyList<SensorGatewayResponse>>(okResult.Value);
        Assert.Equal(2, gateways.Count);

        var gatewayOne = Assert.Single(gateways, g => g.GatewayId == "gw-1");
        Assert.Equal(2, gatewayOne.ReadingCount);
        Assert.Equal(-75m, gatewayOne.AverageRssi);

        var gatewayTwo = Assert.Single(gateways, g => g.GatewayId == "gw-2");
        Assert.Equal(1, gatewayTwo.ReadingCount);
        Assert.Equal(-60m, gatewayTwo.AverageRssi);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
