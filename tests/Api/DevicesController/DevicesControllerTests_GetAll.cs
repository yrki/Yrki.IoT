namespace Tests.Api.DevicesControllerTests;

public sealed class DevicesControllerTests_GetAll : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public DevicesControllerTests_GetAll(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_only_active_devices()
    {
        // Arrange
        var location = ApiTestData.CreateLocation("Alpha site");
        var activeDevice = ApiTestData.CreateDevice("sensor-1", "Alpha sensor", DeviceType.CO2, "Tracks CO2", locationId: location.Id, location: location);
        var newDevice = ApiTestData.CreateDevice("sensor-2", "New sensor", DeviceType.CO2, "Pending install", isNew: true);
        var deletedDevice = ApiTestData.CreateDevice("sensor-3", "Deleted sensor", DeviceType.CO2, "Removed", isDeleted: true);

        _dbContext.Locations.Add(location);
        _dbContext.Devices.AddRange(activeDevice, newDevice, deletedDevice);
        await _dbContext.SaveChangesAsync();

        var controller = new DevicesController(
            new SensorsQueryHandler(_dbContext),
            new DeleteSensorCommandHandler(_dbContext));

        // Act
        var result = await controller.GetAll(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var devices = Assert.IsAssignableFrom<IReadOnlyList<SensorListItemResponse>>(okResult.Value);
        var device = Assert.Single(devices);
        Assert.Equal(activeDevice.Id, device.Id);
        Assert.Equal(location.Name, device.LocationName);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
