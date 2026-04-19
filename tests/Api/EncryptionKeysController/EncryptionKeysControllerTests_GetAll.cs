namespace Tests.Api.EncryptionKeysControllerTests;

public sealed class EncryptionKeysControllerTests_GetAll : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;
    private readonly FakeKeyEncryptionService _encryptionService = new();

    public EncryptionKeysControllerTests_GetAll(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_keys_ordered_by_device_and_group()
    {
        // Arrange
        var firstKey = ApiTestData.CreateEncryptionKey(manufacturer: "AXI", deviceUniqueId: "device-1", groupName: "alpha");
        var secondKey = ApiTestData.CreateEncryptionKey(manufacturer: "LAS", deviceUniqueId: "device-2", groupName: "beta");
        _dbContext.EncryptionKeys.AddRange(secondKey, firstKey);
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        // Act
        var result = await controller.GetAll(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var keys = Assert.IsAssignableFrom<IReadOnlyList<EncryptionKeyResponse>>(okResult.Value);
        Assert.Equal([firstKey.Id, secondKey.Id], keys.Select(key => key.Id).ToArray());
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
