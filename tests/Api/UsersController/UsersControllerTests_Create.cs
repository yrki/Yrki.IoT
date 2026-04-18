namespace Tests.Api.UsersControllerTests;

public sealed class UsersControllerTests_Create : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public UsersControllerTests_Create(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_create_user_and_return_created_resource()
    {
        // Arrange
        var controller = CreateController();
        var request = new CreateUserRequest(" new.user@example.com ");

        // Act
        var result = await controller.Create(request, CancellationToken.None);

        // Assert
        var createdResult = Assert.IsType<CreatedResult>(result);
        var response = Assert.IsType<UserResponse>(createdResult.Value);
        var entity = await _dbContext.Users.SingleAsync();
        Assert.Equal($"/users/{response.Id}", createdResult.Location);
        Assert.Equal("new.user@example.com", entity.Email);
        Assert.Equal("NEW.USER@EXAMPLE.COM", entity.NormalizedEmail);
    }

    [Fact]
    public async Task Shall_return_conflict_when_email_already_exists()
    {
        // Arrange
        _dbContext.Users.Add(new AppUser
        {
            Id = Guid.NewGuid(),
            Email = "existing@example.com",
            NormalizedEmail = "EXISTING@EXAMPLE.COM",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        // Act
        var result = await controller.Create(new CreateUserRequest(" Existing@example.com "), CancellationToken.None);

        // Assert
        Assert.IsType<ConflictResult>(result);
        Assert.Equal(1, await _dbContext.Users.CountAsync());
    }

    private UsersController CreateController() =>
        new(
            new UsersQueryHandler(_dbContext, NullLogger<UsersQueryHandler>.Instance),
            new CreateUserCommandHandler(_dbContext, NullLogger<CreateUserCommandHandler>.Instance),
            new UpdateUserCommandHandler(_dbContext, NullLogger<UpdateUserCommandHandler>.Instance),
            new DeleteUserCommandHandler(_dbContext, NullLogger<DeleteUserCommandHandler>.Instance));

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
