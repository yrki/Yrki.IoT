namespace Tests.Api.EncryptionKeysControllerTests;

public sealed class EncryptionKeysControllerTests_Update : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;
    private readonly FakeKeyEncryptionService _encryptionService = new();

    public EncryptionKeysControllerTests_Update(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_update_existing_key_and_return_updated_representation()
    {
        // Arrange
        var key = ApiTestData.CreateEncryptionKey(manufacturer: "LAS", deviceUniqueId: "device-1", groupName: "alpha", encryptedKeyValue: "encrypted:old-key");
        _dbContext.EncryptionKeys.Add(key);
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();
        var request = new UpdateEncryptionKeyRequest("AXI", "device-2", "beta", "new-key", "Updated key");

        // Act
        var result = await controller.Update(key.Id, request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<EncryptionKeyResponse>(okResult.Value);
        var entity = await _dbContext.EncryptionKeys.SingleAsync();
        Assert.Equal(key.Id, response.Id);
        Assert.Equal("AXI", entity.Manufacturer);
        Assert.Equal("DEVICE-2", entity.DeviceUniqueId);
        Assert.NotEqual("NEW-KEY", entity.EncryptedKeyValue);
        Assert.NotEmpty(entity.EncryptedKeyValue);
        Assert.Null(response.KeyValue);
        Assert.True(response.HasKey);
        Assert.NotNull(entity.UpdatedAt);
    }

    [Fact]
    public async Task Shall_return_not_found_when_key_does_not_exist()
    {
        // Arrange
        var controller = CreateController();
        var request = new UpdateEncryptionKeyRequest("AXI", "device-2", "beta", "new-key", "Updated key");

        // Act
        var result = await controller.Update(Guid.NewGuid(), request, CancellationToken.None);

        // Assert
        Assert.IsType<NotFoundResult>(result);
    }

    private EncryptionKeysController CreateController()
    {
        return new EncryptionKeysController(
            new EncryptionKeysQueryHandler(_dbContext, NullLogger<EncryptionKeysQueryHandler>.Instance),
            new CreateEncryptionKeyCommandHandler(_dbContext, _encryptionService, NullLogger<CreateEncryptionKeyCommandHandler>.Instance),
            new UpdateEncryptionKeyCommandHandler(_dbContext, _encryptionService, NullLogger<UpdateEncryptionKeyCommandHandler>.Instance),
            new DeleteEncryptionKeyCommandHandler(_dbContext, NullLogger<DeleteEncryptionKeyCommandHandler>.Instance));
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
