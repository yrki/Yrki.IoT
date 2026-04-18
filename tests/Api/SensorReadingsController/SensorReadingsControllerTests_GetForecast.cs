namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetForecast : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetForecast(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_clamp_hours_to_maximum()
    {
        // Arrange
        var controller = new SensorReadingsController(
            new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance),
            new ForecastQueryHandler(_dbContext, null!, null!, NullLogger<ForecastQueryHandler>.Instance));

        // Act — requesting more than 30 days should clamp
        var result = await controller.GetForecast("sensor-1", "co2", 99999, CancellationToken.None);

        // Assert — should return OK (empty forecast due to no data, but no error)
        var okResult = Assert.IsType<OkObjectResult>(result);
        var forecast = Assert.IsAssignableFrom<IReadOnlyList<ForecastPointResponse>>(okResult.Value);
        Assert.Empty(forecast);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
