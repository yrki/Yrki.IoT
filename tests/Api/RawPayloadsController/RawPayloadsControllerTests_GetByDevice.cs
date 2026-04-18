namespace Tests.Api.RawPayloadsControllerTests;

public sealed class RawPayloadsControllerTests_GetByDevice : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public RawPayloadsControllerTests_GetByDevice(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_payloads_for_requested_device_ordered_newest_first()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.RawPayloads.AddRange(
            CreatePayload("sensor-1", "AABB", now.AddMinutes(-30)),
            CreatePayload("sensor-1", "CCDD", now.AddMinutes(-5)),
            CreatePayload("sensor-1", "EEFF", now.AddHours(-2)));
        await _dbContext.SaveChangesAsync();

        var controller = BuildController();

        // Act
        var result = await controller.GetByDevice("sensor-1", 100, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var payloads = Assert.IsAssignableFrom<IReadOnlyList<RawPayloadResponse>>(okResult.Value);
        Assert.Equal(3, payloads.Count);
        Assert.Equal("CCDD", payloads[0].PayloadHex);
        Assert.Equal("AABB", payloads[1].PayloadHex);
        Assert.Equal("EEFF", payloads[2].PayloadHex);
    }

    [Fact]
    public async Task Shall_only_return_payloads_for_the_requested_device()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        _dbContext.RawPayloads.AddRange(
            CreatePayload("sensor-1", "0011", now.AddMinutes(-1)),
            CreatePayload("sensor-2", "2233", now.AddMinutes(-1)));
        await _dbContext.SaveChangesAsync();

        var controller = BuildController();

        // Act
        var result = await controller.GetByDevice("sensor-1", 100, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var payloads = Assert.IsAssignableFrom<IReadOnlyList<RawPayloadResponse>>(okResult.Value);
        var payload = Assert.Single(payloads);
        Assert.Equal("sensor-1", payload.DeviceId);
        Assert.Equal("0011", payload.PayloadHex);
    }

    [Fact]
    public async Task Shall_limit_the_number_of_returned_payloads()
    {
        // Arrange
        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < 10; i++)
        {
            _dbContext.RawPayloads.Add(CreatePayload("sensor-1", $"{i:X4}", now.AddMinutes(-i)));
        }
        await _dbContext.SaveChangesAsync();

        var controller = BuildController();

        // Act
        var result = await controller.GetByDevice("sensor-1", 3, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var payloads = Assert.IsAssignableFrom<IReadOnlyList<RawPayloadResponse>>(okResult.Value);
        Assert.Equal(3, payloads.Count);
        Assert.Equal("0000", payloads[0].PayloadHex);
        Assert.Equal("0001", payloads[1].PayloadHex);
        Assert.Equal("0002", payloads[2].PayloadHex);
    }

    [Fact]
    public async Task Shall_return_empty_list_when_no_payloads_exist_for_device()
    {
        // Arrange
        _dbContext.RawPayloads.Add(CreatePayload("sensor-other", "ABCD", DateTimeOffset.UtcNow));
        await _dbContext.SaveChangesAsync();

        var controller = BuildController();

        // Act
        var result = await controller.GetByDevice("sensor-1", 100, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var payloads = Assert.IsAssignableFrom<IReadOnlyList<RawPayloadResponse>>(okResult.Value);
        Assert.Empty(payloads);
    }

    private RawPayloadsController BuildController()
        => new(new RawPayloadsQueryHandler(_dbContext, NullLogger<RawPayloadsQueryHandler>.Instance));

    private static RawPayload CreatePayload(string deviceId, string payloadHex, DateTimeOffset receivedAt)
        => new()
        {
            Id = Guid.NewGuid(),
            DeviceId = deviceId,
            ReceivedAt = receivedAt,
            PayloadHex = payloadHex,
            Source = "test",
            Manufacturer = "Acme",
            GatewayId = "gateway-1",
            Rssi = -70,
        };

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
