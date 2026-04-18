namespace Tests.Api.GatewayPositionsControllerTests;

public sealed class GatewayPositionsControllerTests_GetPositions : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public GatewayPositionsControllerTests_GetPositions(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_only_recent_positions_for_requested_gateway()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-30), 10.75, 59.91),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddHours(-25), 10.76, 59.92),
            ApiTestData.CreateGatewayPosition("GW-002", now.AddMinutes(-10), 11.0, 60.0));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetPositions("GW-001", hours: 24, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var positions = Assert.IsAssignableFrom<IReadOnlyList<GatewayPositionResponse>>(okResult.Value);
        Assert.Single(positions);
        Assert.Equal("GW-001", positions[0].GatewayUniqueId);
        Assert.Equal(10.75, positions[0].Longitude);
    }

    [Fact]
    public async Task Shall_return_positions_ordered_by_timestamp()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-10), 10.1, 59.1),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-30), 10.2, 59.2),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-20), 10.3, 59.3));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetPositions("GW-001", hours: 1, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var positions = Assert.IsAssignableFrom<IReadOnlyList<GatewayPositionResponse>>(okResult.Value);
        Assert.Equal(3, positions.Count);
        Assert.True(positions[0].Timestamp < positions[1].Timestamp);
        Assert.True(positions[1].Timestamp < positions[2].Timestamp);
    }

    [Fact]
    public async Task Shall_return_empty_list_when_no_positions()
    {
        // Arrange
        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetPositions("GW-NONEXISTENT", hours: 24, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var positions = Assert.IsAssignableFrom<IReadOnlyList<GatewayPositionResponse>>(okResult.Value);
        Assert.Empty(positions);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
