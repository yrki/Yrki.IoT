namespace Tests.Api.LocationsControllerTests;

public sealed class LocationsControllerTests_GetAll : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public LocationsControllerTests_GetAll(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_locations_with_count_of_installed_devices()
    {
        // Arrange
        var location = ApiTestData.CreateLocation("Alpha site");
        var installedDevice = ApiTestData.CreateDevice("sensor-1", "Installed sensor", "CarbonDioxide", "Installed", locationId: location.Id, location: location);
        var newDevice = ApiTestData.CreateDevice("sensor-2", "New sensor", "CarbonDioxide", "Pending", locationId: location.Id, location: location, isNew: true);
        var deletedDevice = ApiTestData.CreateDevice("sensor-3", "Deleted sensor", "CarbonDioxide", "Removed", locationId: location.Id, location: location, isDeleted: true);

        _dbContext.Locations.Add(location);
        _dbContext.Devices.AddRange(installedDevice, newDevice, deletedDevice);
        await _dbContext.SaveChangesAsync();

        var controller = new LocationsController(
            new LocationsQueryHandler(_dbContext),
            new CreateLocationCommandHandler(_dbContext),
            new UpdateLocationCommandHandler(_dbContext),
            new DeleteLocationCommandHandler(_dbContext));

        // Act
        var result = await controller.GetAll(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var locations = Assert.IsAssignableFrom<IReadOnlyList<LocationResponse>>(okResult.Value);
        var response = Assert.Single(locations);
        Assert.Equal(location.Id, response.Id);
        Assert.Equal(1, response.DeviceCount);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
