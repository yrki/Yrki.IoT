namespace Tests.Api.AuthControllerTests;

public sealed class AuthControllerTests_VerifyMagicLink : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public AuthControllerTests_VerifyMagicLink(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_ok_when_magic_link_is_valid()
    {
        // Arrange
        var expectedResponse = new AuthResponse
        {
            AccessToken = "jwt-token",
            ExpiresAtUtc = DateTime.UtcNow.AddHours(1),
            User = new CurrentUserResponse
            {
                Id = Guid.NewGuid(),
                Email = "operator@yrki.no"
            }
        };
        var magicLinkService = new FakeMagicLinkService
        {
            VerifyResponse = expectedResponse
        };
        var controller = new AuthController(magicLinkService, _dbContext);
        var request = new MagicLinkVerifyRequest { Token = "valid-token" };

        // Act
        var result = await controller.VerifyMagicLink(request, CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthResponse>(okResult.Value);
        Assert.Equal(expectedResponse.AccessToken, response.AccessToken);
        Assert.Equal(request.Token, magicLinkService.VerifiedToken);
    }

    [Fact]
    public async Task Shall_return_unauthorized_when_magic_link_is_invalid()
    {
        // Arrange
        var magicLinkService = new FakeMagicLinkService();
        var controller = new AuthController(magicLinkService, _dbContext);
        var request = new MagicLinkVerifyRequest { Token = "invalid-token" };

        // Act
        var result = await controller.VerifyMagicLink(request, CancellationToken.None);

        // Assert
        Assert.IsType<UnauthorizedResult>(result);
        Assert.Equal(request.Token, magicLinkService.VerifiedToken);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
