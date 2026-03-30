namespace Tests.Api.DevicesControllerTests;

public sealed class DevicesControllerTests_Delete : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public DevicesControllerTests_Delete(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_soft_delete_existing_device()
    {
        // Arrange
        var device = ApiTestData.CreateDevice("sensor-1", "Alpha sensor", DeviceType.CO2, "Tracks CO2");
        _dbContext.Devices.Add(device);
        await _dbContext.SaveChangesAsync();

        var controller = new DevicesController(
            new SensorsQueryHandler(_dbContext),
            new DeleteSensorCommandHandler(_dbContext));

        // Act
        var result = await controller.Delete(device.Id, CancellationToken.None);

        // Assert
        Assert.IsType<NoContentResult>(result);
        Assert.True(await _dbContext.Devices.Where(candidate => candidate.Id == device.Id).Select(candidate => candidate.IsDeleted).SingleAsync());
    }

    [Fact]
    public async Task Shall_return_not_found_when_device_does_not_exist()
    {
        // Arrange
        var controller = new DevicesController(
            new SensorsQueryHandler(_dbContext),
            new DeleteSensorCommandHandler(_dbContext));

        // Act
        var result = await controller.Delete(Guid.NewGuid(), CancellationToken.None);

        // Assert
        Assert.IsType<NotFoundResult>(result);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
