namespace Tests.Api.LocationsControllerTests;

public sealed class LocationsControllerTests_Update : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public LocationsControllerTests_Update(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_update_existing_location()
    {
        // Arrange
        var location = ApiTestData.CreateLocation("Old name", "Old description");
        _dbContext.Locations.Add(location);
        await _dbContext.SaveChangesAsync();

        var controller = new LocationsController(
            new LocationsQueryHandler(_dbContext),
            new CreateLocationCommandHandler(_dbContext),
            new UpdateLocationCommandHandler(_dbContext),
            new DeleteLocationCommandHandler(_dbContext));
        var request = new UpdateLocationRequest("New name", "New description");

        // Act
        var result = await controller.Update(location.Id, request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<LocationResponse>(okResult.Value);
        var entity = await _dbContext.Locations.SingleAsync();
        Assert.Equal(location.Id, response.Id);
        Assert.Equal("New name", entity.Name);
        Assert.Equal("New description", entity.Description);
    }

    [Fact]
    public async Task Shall_return_not_found_when_location_does_not_exist()
    {
        // Arrange
        var controller = new LocationsController(
            new LocationsQueryHandler(_dbContext),
            new CreateLocationCommandHandler(_dbContext),
            new UpdateLocationCommandHandler(_dbContext),
            new DeleteLocationCommandHandler(_dbContext));
        var request = new UpdateLocationRequest("New name", "New description");

        // Act
        var result = await controller.Update(Guid.NewGuid(), request, CancellationToken.None);

        // Assert
        Assert.IsType<NotFoundResult>(result);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
