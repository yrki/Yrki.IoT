namespace Tests.Api.GatewayPositionsControllerTests;

public sealed class GatewayPositionsControllerTests_GetDriveBy : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public GatewayPositionsControllerTests_GetDriveBy(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_only_drive_by_positions()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-30), 10.1, 59.1, driveBy: true),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-20), 10.2, 59.2, driveBy: false),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-10), 10.3, 59.3, driveBy: true));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext));

        // Act
        var result = await controller.GetDriveBy("GW-001", hours: 24, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var positions = Assert.IsAssignableFrom<IReadOnlyList<GatewayPositionResponse>>(okResult.Value);
        Assert.Equal(2, positions.Count);
        Assert.All(positions, p => Assert.True(p.DriveBy));
    }

    [Fact]
    public async Task Shall_exclude_positions_outside_time_range()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-30), 10.1, 59.1, driveBy: true),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddHours(-25), 10.2, 59.2, driveBy: true));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext));

        // Act
        var result = await controller.GetDriveBy("GW-001", hours: 24, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var positions = Assert.IsAssignableFrom<IReadOnlyList<GatewayPositionResponse>>(okResult.Value);
        Assert.Single(positions);
        Assert.Equal(10.1, positions[0].Longitude);
    }

    [Fact]
    public async Task Shall_not_include_other_gateways_drive_by_positions()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-10), 10.1, 59.1, driveBy: true),
            ApiTestData.CreateGatewayPosition("GW-002", now.AddMinutes(-10), 11.0, 60.0, driveBy: true));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext));

        // Act
        var result = await controller.GetDriveBy("GW-001", hours: 24, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var positions = Assert.IsAssignableFrom<IReadOnlyList<GatewayPositionResponse>>(okResult.Value);
        Assert.Single(positions);
        Assert.Equal("GW-001", positions[0].GatewayUniqueId);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
