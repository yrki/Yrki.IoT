namespace Tests.Api.DevicesControllerTests;

public sealed class DevicesControllerTests_GetByUniqueId : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public DevicesControllerTests_GetByUniqueId(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_requested_sensor_by_unique_id()
    {
        // Arrange
        var location = ApiTestData.CreateLocation("Alpha");
        var device = ApiTestData.CreateDevice("sensor-1", "Office sensor", "CarbonDioxide", "Tracks CO2", locationId: location.Id, location: location);

        _dbContext.Locations.Add(location);
        _dbContext.Devices.Add(device);
        await _dbContext.SaveChangesAsync();

        var controller = new DevicesController(
            new AllSensorsQueryHandler(_dbContext),
            new SensorsByLocationQueryHandler(_dbContext),
            new SensorsBySensorLocationQueryHandler(_dbContext),
            new SensorByUniqueIdQueryHandler(_dbContext),
            new UpdateDeviceCommandHandler(_dbContext),
            new DeleteSensorCommandHandler(_dbContext));

        // Act
        var result = await controller.GetByUniqueId(device.UniqueId, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<SensorListItemResponse>(okResult.Value);
        Assert.Equal(device.Id, response.Id);
        Assert.Equal(device.UniqueId, response.UniqueId);
        Assert.Equal(location.Id, response.LocationId);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
