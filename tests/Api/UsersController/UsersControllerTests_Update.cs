namespace Tests.Api.UsersControllerTests;

public sealed class UsersControllerTests_Update : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public UsersControllerTests_Update(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_update_user_email()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _dbContext.Users.Add(new AppUser
        {
            Id = userId,
            Email = "old@example.com",
            NormalizedEmail = "OLD@EXAMPLE.COM",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        // Act
        var result = await controller.Update(userId, new UpdateUserRequest("updated@example.com"), CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UserResponse>(okResult.Value);
        Assert.Equal("updated@example.com", response.Email);

        var entity = await _dbContext.Users.SingleAsync();
        Assert.Equal("updated@example.com", entity.Email);
        Assert.Equal("UPDATED@EXAMPLE.COM", entity.NormalizedEmail);
    }

    [Fact]
    public async Task Shall_return_conflict_when_updating_to_existing_email()
    {
        // Arrange
        var firstUserId = Guid.NewGuid();
        var secondUserId = Guid.NewGuid();
        _dbContext.Users.AddRange(
            new AppUser
            {
                Id = firstUserId,
                Email = "first@example.com",
                NormalizedEmail = "FIRST@EXAMPLE.COM",
                CreatedAtUtc = DateTime.UtcNow,
            },
            new AppUser
            {
                Id = secondUserId,
                Email = "second@example.com",
                NormalizedEmail = "SECOND@EXAMPLE.COM",
                CreatedAtUtc = DateTime.UtcNow,
            });
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        // Act
        var result = await controller.Update(firstUserId, new UpdateUserRequest(" second@example.com "), CancellationToken.None);

        // Assert
        Assert.IsType<ConflictResult>(result);
    }

    [Fact]
    public async Task Shall_return_not_found_when_updating_missing_user()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.Update(Guid.NewGuid(), new UpdateUserRequest("missing@example.com"), CancellationToken.None);

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
