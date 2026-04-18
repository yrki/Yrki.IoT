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
        var activeDevice = ApiTestData.CreateDevice("sensor-1", "Alpha sensor", "CarbonDioxide", "Tracks CO2", locationId: location.Id, location: location);
        var newDevice = ApiTestData.CreateDevice("sensor-2", "New sensor", "CarbonDioxide", "Pending install", isNew: true);
        var deletedDevice = ApiTestData.CreateDevice("sensor-3", "Deleted sensor", "CarbonDioxide", "Removed", isDeleted: true);

        _dbContext.Locations.Add(location);
        _dbContext.Devices.AddRange(activeDevice, newDevice, deletedDevice);
        await _dbContext.SaveChangesAsync();

        var controller = new DevicesController(
            new AllSensorsQueryHandler(_dbContext, NullLogger<AllSensorsQueryHandler>.Instance),
            new AllGatewaysQueryHandler(_dbContext, NullLogger<AllGatewaysQueryHandler>.Instance),
            new SensorsByLocationQueryHandler(_dbContext, NullLogger<SensorsByLocationQueryHandler>.Instance),
            new SensorsBySensorLocationQueryHandler(_dbContext, NullLogger<SensorsBySensorLocationQueryHandler>.Instance),
            new SensorByUniqueIdQueryHandler(_dbContext, NullLogger<SensorByUniqueIdQueryHandler>.Instance),
            new UpdateDeviceCommandHandler(_dbContext, NullLogger<UpdateDeviceCommandHandler>.Instance),
            new AssignDevicesToLocationCommandHandler(_dbContext, NullLogger<AssignDevicesToLocationCommandHandler>.Instance),
            new ImportDevicesCommandHandler(_dbContext, NullLogger<ImportDevicesCommandHandler>.Instance),
            new CreateDeviceCommandHandler(_dbContext, NullLogger<CreateDeviceCommandHandler>.Instance),
            new DeleteSensorCommandHandler(_dbContext));

        // Act
        var result = await controller.GetAll(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var devices = Assert.IsAssignableFrom<IReadOnlyList<SensorListItemResponse>>(okResult.Value);
        var device = Assert.Single(devices);
        Assert.Equal(activeDevice.Id, device.Id);
        Assert.Equal(location.Name, device.LocationName);
        Assert.Equal(activeDevice.InstallationDate, device.InstallationDate);
        Assert.Equal(activeDevice.LastContact, device.LastContact);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
