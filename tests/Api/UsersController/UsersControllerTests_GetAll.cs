namespace Tests.Api.UsersControllerTests;

public sealed class UsersControllerTests_GetAll : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public UsersControllerTests_GetAll(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_all_users_ordered_by_email()
    {
        // Arrange
        _dbContext.Users.AddRange(
            new AppUser
            {
                Id = Guid.NewGuid(),
                Email = "zoe@example.com",
                NormalizedEmail = "ZOE@EXAMPLE.COM",
                CreatedAtUtc = new DateTime(2026, 4, 1, 8, 0, 0, DateTimeKind.Utc)
            },
            new AppUser
            {
                Id = Guid.NewGuid(),
                Email = "adam@example.com",
                NormalizedEmail = "ADAM@EXAMPLE.COM",
                CreatedAtUtc = new DateTime(2026, 4, 1, 9, 0, 0, DateTimeKind.Utc)
            });
        await _dbContext.SaveChangesAsync();

        var controller = CreateController();

        // Act
        var result = await controller.GetAll(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsAssignableFrom<IReadOnlyList<UserResponse>>(okResult.Value);
        Assert.Collection(
            response,
            user => Assert.Equal("adam@example.com", user.Email),
            user => Assert.Equal("zoe@example.com", user.Email));
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
