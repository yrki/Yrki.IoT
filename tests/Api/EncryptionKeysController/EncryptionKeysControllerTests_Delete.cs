namespace Tests.Api.EncryptionKeysControllerTests;

public sealed class EncryptionKeysControllerTests_Delete : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;
    private readonly FakeKeyEncryptionService _encryptionService = new();

    public EncryptionKeysControllerTests_Delete(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_delete_existing_key()
    {
        // Arrange
        var key = ApiTestData.CreateEncryptionKey();
        _dbContext.EncryptionKeys.Add(key);
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        // Act
        var result = await controller.Delete(key.Id, CancellationToken.None);

        // Assert
        Assert.IsType<NoContentResult>(result);
        Assert.False(await _dbContext.EncryptionKeys.AnyAsync());
    }

    [Fact]
    public async Task Shall_return_not_found_when_key_does_not_exist()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.Delete(Guid.NewGuid(), CancellationToken.None);

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
