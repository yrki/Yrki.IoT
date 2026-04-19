namespace Tests.Api.DevicesControllerTests;

public sealed class DevicesControllerTests_DeleteGateway : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public DevicesControllerTests_DeleteGateway(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_soft_delete_gateway()
    {
        // Arrange
        var gateway = ApiTestData.CreateDevice("gw-1", "Gateway North", "Gateway", "North wing", kind: DeviceKind.Gateway);
        _dbContext.Devices.Add(gateway);
        await _dbContext.SaveChangesAsync();

        var controller = BuildController();

        // Act
        var result = await controller.Delete(gateway.Id, CancellationToken.None);

        // Assert
        Assert.IsType<NoContentResult>(result);
        var entity = await _dbContext.Devices.SingleAsync(d => d.Id == gateway.Id);
        Assert.True(entity.IsDeleted);
    }

    [Fact]
    public async Task Shall_exclude_deleted_gateway_from_gateway_list()
    {
        // Arrange
        var activeGateway = ApiTestData.CreateDevice("gw-1", "Active Gateway", "Gateway", "Still running", kind: DeviceKind.Gateway);
        var deletedGateway = ApiTestData.CreateDevice("gw-2", "Deleted Gateway", "Gateway", "Removed", kind: DeviceKind.Gateway, isDeleted: true);
        _dbContext.Devices.AddRange(activeGateway, deletedGateway);
        await _dbContext.SaveChangesAsync();

        var controller = BuildController();

        // Act
        var result = await controller.GetGateways(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var gateways = Assert.IsAssignableFrom<IReadOnlyList<SensorListItemResponse>>(okResult.Value);
        Assert.Single(gateways);
        Assert.Equal("gw-1", gateways[0].UniqueId);
    }

    [Fact]
    public async Task Shall_preserve_readings_after_gateway_deletion()
    {
        // Arrange
        var gateway = ApiTestData.CreateDevice("gw-1", "Gateway North", "Gateway", "North wing", kind: DeviceKind.Gateway);
        _dbContext.Devices.Add(gateway);

        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayReadings.AddRange(
            ApiTestData.CreateGatewayReading("gw-1", "sensor-1", now.AddMinutes(-30), -80),
            ApiTestData.CreateGatewayReading("gw-1", "sensor-2", now.AddMinutes(-10), -70));
        await _dbContext.SaveChangesAsync();

        var controller = BuildController();

        // Act
        await controller.Delete(gateway.Id, CancellationToken.None);

        // Assert
        var readings = await _dbContext.GatewayReadings.Where(r => r.GatewayUniqueId == "gw-1").ToListAsync();
        Assert.Equal(2, readings.Count);
    }

    private DevicesController BuildController()
    {
        return new DevicesController(
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
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
