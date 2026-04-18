namespace Tests.Api.LocationsControllerTests;

public sealed class LocationsControllerTests_Delete : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public LocationsControllerTests_Delete(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_delete_existing_location()
    {
        // Arrange
        var location = ApiTestData.CreateLocation();
        _dbContext.Locations.Add(location);
        await _dbContext.SaveChangesAsync();

        var controller = new LocationsController(
            new LocationsQueryHandler(_dbContext, NullLogger<LocationsQueryHandler>.Instance),
            new CreateLocationCommandHandler(_dbContext, NullLogger<CreateLocationCommandHandler>.Instance),
            new UpdateLocationCommandHandler(_dbContext, NullLogger<UpdateLocationCommandHandler>.Instance),
            new DeleteLocationCommandHandler(_dbContext, NullLogger<DeleteLocationCommandHandler>.Instance));

        // Act
        var result = await controller.Delete(location.Id, CancellationToken.None);

        // Assert
        Assert.IsType<NoContentResult>(result);
        Assert.False(await _dbContext.Locations.AnyAsync());
    }

    [Fact]
    public async Task Shall_return_not_found_when_location_does_not_exist()
    {
        // Arrange
        var controller = new LocationsController(
            new LocationsQueryHandler(_dbContext, NullLogger<LocationsQueryHandler>.Instance),
            new CreateLocationCommandHandler(_dbContext, NullLogger<CreateLocationCommandHandler>.Instance),
            new UpdateLocationCommandHandler(_dbContext, NullLogger<UpdateLocationCommandHandler>.Instance),
            new DeleteLocationCommandHandler(_dbContext, NullLogger<DeleteLocationCommandHandler>.Instance));

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
