namespace Tests.Api.DevicesControllerTests;

public sealed class DevicesControllerTests_Create : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public DevicesControllerTests_Create(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_create_new_device_with_required_fields()
    {
        // Arrange
        var controller = BuildController();
        var request = new CreateDeviceRequest("sensor-new-001", "Acme", null, null);

        // Act
        var result = await controller.Create(request, CancellationToken.None);

        // Assert
        var created = Assert.IsType<CreatedResult>(result);
        var response = Assert.IsType<SensorListItemResponse>(created.Value);
        Assert.Equal("sensor-new-001", response.UniqueId);
        Assert.Equal("Acme", response.Manufacturer);
        Assert.Equal("Unknown", response.Type);

        var entity = await _dbContext.Devices.SingleAsync();
        Assert.Equal("sensor-new-001", entity.UniqueId);
        Assert.Equal("Acme", entity.Manufacturer);
    }

    [Fact]
    public async Task Shall_create_device_with_all_fields()
    {
        // Arrange
        var controller = BuildController();
        var request = new CreateDeviceRequest("sensor-full-001", "MeterCo", "Office meter", "WaterMeter");

        // Act
        var result = await controller.Create(request, CancellationToken.None);

        // Assert
        var created = Assert.IsType<CreatedResult>(result);
        var response = Assert.IsType<SensorListItemResponse>(created.Value);
        Assert.Equal("sensor-full-001", response.UniqueId);
        Assert.Equal("MeterCo", response.Manufacturer);
        Assert.Equal("Office meter", response.Name);
        Assert.Equal("WaterMeter", response.Type);
    }

    [Fact]
    public async Task Shall_return_conflict_when_device_already_exists()
    {
        // Arrange
        _dbContext.Devices.Add(ApiTestData.CreateDevice("existing-001", "Existing", "Sensor", ""));
        await _dbContext.SaveChangesAsync();

        var controller = BuildController();
        var request = new CreateDeviceRequest("existing-001", "Acme", null, null);

        // Act
        var result = await controller.Create(request, CancellationToken.None);

        // Assert
        Assert.IsType<ConflictObjectResult>(result);
    }

    private DevicesController BuildController() =>
        new(
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

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
