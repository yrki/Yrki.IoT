namespace Tests.Api.EncryptionKeysControllerTests;

public sealed class EncryptionKeysControllerTests_GetByDevice : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;
    private readonly FakeKeyEncryptionService _encryptionService = new();

    public EncryptionKeysControllerTests_GetByDevice(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_matching_key_for_device_unique_id()
    {
        // Arrange
        var key = ApiTestData.CreateEncryptionKey(deviceUniqueId: "device-1");
        _dbContext.EncryptionKeys.Add(key);
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        // Act
        var result = await controller.GetByDevice("device-1", CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<EncryptionKeyResponse>(okResult.Value);
        Assert.Equal(key.Id, response.Id);
    }

    [Fact]
    public async Task Shall_return_not_found_when_device_unique_id_has_no_key()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetByDevice("missing-device", CancellationToken.None);

        // Assert
        Assert.IsType<NotFoundResult>(result);
    }

    private EncryptionKeysController CreateController()
    {
        return new EncryptionKeysController(
            new EncryptionKeysQueryHandler(_dbContext),
            new CreateEncryptionKeyCommandHandler(_dbContext, _encryptionService),
            new UpdateEncryptionKeyCommandHandler(_dbContext, _encryptionService),
            new DeleteEncryptionKeyCommandHandler(_dbContext));
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
