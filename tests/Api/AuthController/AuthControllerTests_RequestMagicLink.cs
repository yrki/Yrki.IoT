namespace Tests.Api.AuthControllerTests;

public sealed class AuthControllerTests_RequestMagicLink : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public AuthControllerTests_RequestMagicLink(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_accepted_and_delegate_request_to_magic_link_service()
    {
        // Arrange
        var magicLinkService = new FakeMagicLinkService();
        var controller = new AuthController(magicLinkService, _dbContext);
        var request = new MagicLinkRequest { Email = "operator@yrki.no" };

        // Act
        var result = await controller.RequestMagicLink(request, CancellationToken.None);

        // Assert
        Assert.IsType<AcceptedResult>(result);
        Assert.Equal(request.Email, magicLinkService.RequestedEmail);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
