namespace Tests.Api.NewDevicesControllerTests;

public sealed class NewDevicesControllerTests_UpdateDevice : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public NewDevicesControllerTests_UpdateDevice(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_update_new_device_and_mark_it_as_processed()
    {
        // Arrange
        var location = ApiTestData.CreateLocation();
        var device = ApiTestData.CreateDevice("sensor-1", "New sensor", "CarbonDioxide", "Pending install", isNew: true);
        _dbContext.Locations.Add(location);
        _dbContext.Devices.Add(device);
        await _dbContext.SaveChangesAsync();

        var controller = new NewDevicesController(
            new NewDevicesQueryHandler(_dbContext),
            new UpdateDeviceCommandHandler(_dbContext));
        var request = new UpdateDeviceRequest("Installed sensor", "Installed in lobby", location.Id);

        // Act
        var result = await controller.UpdateDevice(device.Id, request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<NewDeviceResponse>(okResult.Value);
        var entity = await _dbContext.Devices.SingleAsync();
        Assert.Equal(device.Id, response.Id);
        Assert.False(entity.IsNew);
        Assert.Equal(location.Id, entity.LocationId);
        Assert.Equal("Installed sensor", entity.Name);
    }

    [Fact]
    public async Task Shall_return_not_found_when_device_does_not_exist()
    {
        // Arrange
        var controller = new NewDevicesController(
            new NewDevicesQueryHandler(_dbContext),
            new UpdateDeviceCommandHandler(_dbContext));
        var request = new UpdateDeviceRequest("Installed sensor", "Installed in lobby", Guid.NewGuid());

        // Act
        var result = await controller.UpdateDevice(Guid.NewGuid(), request, CancellationToken.None);

        // Assert
        Assert.IsType<NotFoundResult>(result);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
