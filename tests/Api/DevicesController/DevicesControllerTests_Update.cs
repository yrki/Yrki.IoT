namespace Tests.Api.DevicesControllerTests;

public sealed class DevicesControllerTests_Update : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public DevicesControllerTests_Update(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_update_existing_device_location()
    {
        // Arrange
        var location = ApiTestData.CreateLocation("Lobby");
        var device = ApiTestData.CreateDevice("sensor-1", "Alpha sensor", "CarbonDioxide", "Tracks CO2");

        _dbContext.Locations.Add(location);
        _dbContext.Devices.Add(device);
        await _dbContext.SaveChangesAsync();

        var controller = new DevicesController(
            new AllSensorsQueryHandler(_dbContext),
            new AllGatewaysQueryHandler(_dbContext),
            new SensorsByLocationQueryHandler(_dbContext),
            new SensorsBySensorLocationQueryHandler(_dbContext),
            new SensorByUniqueIdQueryHandler(_dbContext),
            new UpdateDeviceCommandHandler(_dbContext),
            new DeleteSensorCommandHandler(_dbContext));

        var request = new UpdateDeviceRequest(device.Name, device.Description, location.Id);

        // Act
        var result = await controller.Update(device.Id, request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<NewDeviceResponse>(okResult.Value);
        var entity = await _dbContext.Devices.SingleAsync();

        Assert.Equal(location.Id, entity.LocationId);
        Assert.Equal(location.Id, response.LocationId);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
