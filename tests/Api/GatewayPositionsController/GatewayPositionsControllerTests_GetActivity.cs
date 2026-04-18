namespace Tests.Api.GatewayPositionsControllerTests;

public sealed class GatewayPositionsControllerTests_GetActivity : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public GatewayPositionsControllerTests_GetActivity(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_hourly_buckets_from_gateway_positions()
    {
        // Arrange — use fixed timestamps within known hour boundaries
        var hour1 = new DateTimeOffset(2026, 4, 17, 10, 0, 0, TimeSpan.Zero);
        var hour2 = new DateTimeOffset(2026, 4, 17, 12, 0, 0, TimeSpan.Zero);

        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", hour1.AddMinutes(5), 10.1, 59.1),
            ApiTestData.CreateGatewayPosition("GW-001", hour1.AddMinutes(20), 10.2, 59.2),
            ApiTestData.CreateGatewayPosition("GW-001", hour2.AddMinutes(10), 10.3, 59.3));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetActivity("GW-001", hours: 24 * 90, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var buckets = Assert.IsAssignableFrom<IReadOnlyList<GatewayActivityBucketResponse>>(okResult.Value);
        Assert.Equal(2, buckets.Count);
        Assert.Equal(3, buckets.Sum(b => b.ContactCount));
    }

    [Fact]
    public async Task Shall_count_multiple_positions_in_same_hour()
    {
        // Arrange — both timestamps within the same hour
        var hour = new DateTimeOffset(2026, 4, 17, 14, 0, 0, TimeSpan.Zero);

        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", hour.AddMinutes(10), 10.1, 59.1),
            ApiTestData.CreateGatewayPosition("GW-001", hour.AddMinutes(30), 10.2, 59.2));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetActivity("GW-001", hours: 24 * 90, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var buckets = Assert.IsAssignableFrom<IReadOnlyList<GatewayActivityBucketResponse>>(okResult.Value);
        var bucket = Assert.Single(buckets);
        Assert.Equal(2, bucket.ContactCount);
    }

    [Fact]
    public async Task Shall_not_include_other_gateways()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-10), 10.1, 59.1),
            ApiTestData.CreateGatewayPosition("GW-002", now.AddMinutes(-10), 11.0, 60.0));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetActivity("GW-001", hours: 24, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var buckets = Assert.IsAssignableFrom<IReadOnlyList<GatewayActivityBucketResponse>>(okResult.Value);
        var bucket = Assert.Single(buckets);
        Assert.Equal(1, bucket.ContactCount);
    }

    [Fact]
    public async Task Shall_exclude_activity_outside_time_range()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.GatewayPositions.AddRange(
            ApiTestData.CreateGatewayPosition("GW-001", now.AddMinutes(-10), 10.1, 59.1),
            ApiTestData.CreateGatewayPosition("GW-001", now.AddHours(-25), 10.2, 59.2));
        await _dbContext.SaveChangesAsync();

        var controller = new GatewayPositionsController(new GatewayPositionsQueryHandler(_dbContext, NullLogger<GatewayPositionsQueryHandler>.Instance));

        // Act
        var result = await controller.GetActivity("GW-001", hours: 24, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var buckets = Assert.IsAssignableFrom<IReadOnlyList<GatewayActivityBucketResponse>>(okResult.Value);
        Assert.Single(buckets);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
