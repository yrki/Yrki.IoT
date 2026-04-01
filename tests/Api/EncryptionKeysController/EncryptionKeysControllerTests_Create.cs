namespace Tests.Api.EncryptionKeysControllerTests;

public sealed class EncryptionKeysControllerTests_Create : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;
    private readonly FakeKeyEncryptionService _encryptionService = new();

    public EncryptionKeysControllerTests_Create(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_create_key_and_return_created_resource()
    {
        // Arrange
        var controller = CreateController();
        var request = new CreateEncryptionKeyRequest("AXI", "device-1", "alpha", "plain-key", "For north wing");

        // Act
        var result = await controller.Create(request, CancellationToken.None);

        // Assert
        var createdResult = Assert.IsType<CreatedResult>(result);
        var response = Assert.IsType<EncryptionKeyResponse>(createdResult.Value);
        var entity = await _dbContext.EncryptionKeys.SingleAsync();
        Assert.Equal($"/encryptionkeys/{response.Id}", createdResult.Location);
        Assert.Equal("encrypted:plain-key", entity.EncryptedKeyValue);
        Assert.Equal("AXI", entity.Manufacturer);
        Assert.Equal("device-1", entity.DeviceUniqueId);
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
