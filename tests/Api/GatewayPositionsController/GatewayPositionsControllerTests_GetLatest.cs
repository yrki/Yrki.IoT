namespace Tests.Api.GatewayPositionsControllerTests;

public sealed class GatewayPositionsControllerTests_GetLatest : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public GatewayPositionsControllerTests_GetLatest(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_most_recent_position()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", now.AddHours(-2), 10.1, 59.1, heading: 90.0),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-5), 10.2, 59.2, heading: 180.0),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddHours(-1), 10.3, 59.3));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetLatest("GW-001", CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var position = Assert.IsType<GatewayPositionResponse>(okResult.Value);
        Assert.Equal(10.2, position.Longitude);
        Assert.Equal(59.2, position.Latitude);
        Assert.Equal(180.0, position.Heading);
    }

    [Fact]
    public async Task Shall_return_not_found_when_no_positions_exist()
    {
        // Arrange
        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetLatest("GW-NONEXISTENT", CancellationToken.None);

        // Assert
        Assert.IsType<NotFoundResult>(result);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
