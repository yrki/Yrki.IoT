namespace Tests.Api.DevicesControllerTests;

public sealed class DevicesControllerTests_GetBySensorLocation : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public DevicesControllerTests_GetBySensorLocation(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_only_devices_for_same_location_as_requested_sensor()
    {
        // Arrange
        var matchingLocation = ApiTestData.CreateLocation("North");
        var otherLocation = ApiTestData.CreateLocation("South");
        var requestedDevice = ApiTestData.CreateDevice("sensor-1", "North sensor", "CarbonDioxide", "North wing", locationId: matchingLocation.Id, location: matchingLocation);
        var matchingDevice = ApiTestData.CreateDevice("sensor-2", "Lobby sensor", "CarbonDioxide", "Lobby", locationId: matchingLocation.Id, location: matchingLocation);
        var otherDevice = ApiTestData.CreateDevice("sensor-3", "South sensor", "WaterMeter", "South wing", locationId: otherLocation.Id, location: otherLocation);

        _dbContext.Locations.AddRange(matchingLocation, otherLocation);
        _dbContext.Devices.AddRange(requestedDevice, matchingDevice, otherDevice);
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
        var result = await controller.GetBySensorLocation(requestedDevice.UniqueId, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var devices = Assert.IsAssignableFrom<IReadOnlyList<SensorListItemResponse>>(okResult.Value);
        Assert.Equal(2, devices.Count);
        Assert.All(devices, device => Assert.Equal(matchingLocation.Id, device.LocationId));
        Assert.Contains(devices, device => device.Id == requestedDevice.Id);
        Assert.Contains(devices, device => device.Id == matchingDevice.Id);
    }

    [Fact]
    public async Task Shall_return_only_requested_sensor_when_it_has_no_location()
    {
        // Arrange
        var requestedDevice = ApiTestData.CreateDevice("sensor-1", "Unassigned sensor", "CarbonDioxide", "No location");
        var otherUnassignedDevice = ApiTestData.CreateDevice("sensor-2", "Another unassigned sensor", "WaterMeter", "No location");

        _dbContext.Devices.AddRange(requestedDevice, otherUnassignedDevice);
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
        var result = await controller.GetBySensorLocation(requestedDevice.UniqueId, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var devices = Assert.IsAssignableFrom<IReadOnlyList<SensorListItemResponse>>(okResult.Value);
        var device = Assert.Single(devices);
        Assert.Equal(requestedDevice.Id, device.Id);
        Assert.Null(device.LocationId);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
