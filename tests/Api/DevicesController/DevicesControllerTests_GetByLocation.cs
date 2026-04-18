namespace Tests.Api.DevicesControllerTests;

public sealed class DevicesControllerTests_GetByLocation : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public DevicesControllerTests_GetByLocation(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_only_devices_for_requested_location()
    {
        // Arrange
        var matchingLocation = ApiTestData.CreateLocation("North");
        var otherLocation = ApiTestData.CreateLocation("South");
        var matchingDevice = ApiTestData.CreateDevice("sensor-1", "North sensor", "CarbonDioxide", "North wing", locationId: matchingLocation.Id, location: matchingLocation);
        var otherDevice = ApiTestData.CreateDevice("sensor-2", "South sensor", "WaterMeter", "South wing", locationId: otherLocation.Id, location: otherLocation);

        _dbContext.Locations.AddRange(matchingLocation, otherLocation);
        _dbContext.Devices.AddRange(matchingDevice, otherDevice);
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
        var result = await controller.GetByLocation(matchingLocation.Id, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var devices = Assert.IsAssignableFrom<IReadOnlyList<SensorListItemResponse>>(okResult.Value);
        var device = Assert.Single(devices);
        Assert.Equal(matchingDevice.Id, device.Id);
        Assert.Equal(matchingLocation.Id, device.LocationId);
        Assert.Equal(matchingDevice.InstallationDate, device.InstallationDate);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
