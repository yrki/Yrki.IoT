namespace Tests.Api.LocationsControllerTests;

public sealed class LocationsControllerTests_Create : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public LocationsControllerTests_Create(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_create_location_and_return_created_resource()
    {
        // Arrange
        var controller = new LocationsController(
            new LocationsQueryHandler(_dbContext, NullLogger<LocationsQueryHandler>.Instance),
            new CreateLocationCommandHandler(_dbContext, NullLogger<CreateLocationCommandHandler>.Instance),
            new UpdateLocationCommandHandler(_dbContext, NullLogger<UpdateLocationCommandHandler>.Instance),
            new DeleteLocationCommandHandler(_dbContext, NullLogger<DeleteLocationCommandHandler>.Instance));
        var request = new CreateLocationRequest("Alpha site", "Main campus", null, null, null, null, null);

        // Act
        var result = await controller.Create(request, CancellationToken.None);

        // Assert
        var createdResult = Assert.IsType<CreatedResult>(result);
        var response = Assert.IsType<LocationResponse>(createdResult.Value);
        var entity = await _dbContext.Locations.SingleAsync();
        Assert.Equal($"/locations/{response.Id}", createdResult.Location);
        Assert.Equal(request.Name, entity.Name);
        Assert.Equal(request.Description, entity.Description);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
