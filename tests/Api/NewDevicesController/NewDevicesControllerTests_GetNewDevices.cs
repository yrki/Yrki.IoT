namespace Tests.Api.NewDevicesControllerTests;

public sealed class NewDevicesControllerTests_GetNewDevices : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public NewDevicesControllerTests_GetNewDevices(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_only_new_devices()
    {
        // Arrange
        var newDevice = ApiTestData.CreateDevice("sensor-1", "New sensor", DeviceType.CO2, "Pending install", isNew: true);
        var installedDevice = ApiTestData.CreateDevice("sensor-2", "Installed sensor", DeviceType.CO2, "Installed");
        _dbContext.Devices.AddRange(newDevice, installedDevice);
        await _dbContext.SaveChangesAsync();

        var controller = new NewDevicesController(
            new NewDevicesQueryHandler(_dbContext),
            new UpdateDeviceCommandHandler(_dbContext));

        // Act
        var result = await controller.GetNewDevices(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var devices = Assert.IsAssignableFrom<IReadOnlyList<NewDeviceResponse>>(okResult.Value);
        var device = Assert.Single(devices);
        Assert.Equal(newDevice.Id, device.Id);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
