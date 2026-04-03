namespace Tests.Api.UsersControllerTests;

public sealed class UsersControllerTests_Delete : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public UsersControllerTests_Delete(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_delete_user()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _dbContext.Users.Add(new AppUser
        {
            Id = userId,
            Email = "delete.me@example.com",
            NormalizedEmail = "DELETE.ME@EXAMPLE.COM",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        // Act
        var result = await controller.Delete(userId, CancellationToken.None);

        // Assert
        Assert.IsType<NoContentResult>(result);
        Assert.Empty(_dbContext.Users);
    }

    [Fact]
    public async Task Shall_return_not_found_when_deleting_missing_user()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.Delete(Guid.NewGuid(), CancellationToken.None);

        // Assert
        Assert.IsType<NotFoundResult>(result);
    }

    private UsersController CreateController() =>
        new(
            new UsersQueryHandler(_dbContext),
            new CreateUserCommandHandler(_dbContext),
            new UpdateUserCommandHandler(_dbContext),
            new DeleteUserCommandHandler(_dbContext));

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
