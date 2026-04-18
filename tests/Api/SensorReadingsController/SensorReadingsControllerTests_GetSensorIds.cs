namespace Tests.Api.SensorReadingsControllerTests;

public sealed class SensorReadingsControllerTests_GetSensorIds : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public SensorReadingsControllerTests_GetSensorIds(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_distinct_sensor_ids_sorted_ascending()
    {
        // Arrange
        _dbContext.SensorReadings.AddRange(
            ApiTestData.CreateSensorReading("sensor-b", "temperature", 21.5m, DateTimeOffset.UtcNow.AddMinutes(-5)),
            ApiTestData.CreateSensorReading("sensor-a", "co2", 720m, DateTimeOffset.UtcNow.AddMinutes(-4)),
            ApiTestData.CreateSensorReading("sensor-a", "humidity", 45m, DateTimeOffset.UtcNow.AddMinutes(-3)));
        await _dbContext.SaveChangesAsync();

        var controller = new SensorReadingsController(new SensorReadingsQueryHandler(_dbContext, NullLogger<SensorReadingsQueryHandler>.Instance), null!);

        // Act
        var result = await controller.GetSensorIds(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var ids = Assert.IsAssignableFrom<IReadOnlyList<string>>(okResult.Value);
        Assert.Equal(["sensor-a", "sensor-b"], ids);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
