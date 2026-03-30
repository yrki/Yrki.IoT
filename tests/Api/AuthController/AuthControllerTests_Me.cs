using System.Security.Claims;

namespace Tests.Api.AuthControllerTests;

public sealed class AuthControllerTests_Me : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public AuthControllerTests_Me(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    [Fact]
    public async Task Shall_return_current_user_when_subject_claim_matches_existing_user()
    {
        // Arrange
        var user = ApiTestData.CreateUser("operator@yrki.no");
        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        var controller = new AuthController(new FakeMagicLinkService(), _dbContext)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString())],
                        "TestAuth"))
                }
            }
        };

        // Act
        var result = await controller.Me(CancellationToken.None);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<CurrentUserResponse>(okResult.Value);
        Assert.Equal(user.Id, response.Id);
        Assert.Equal(user.Email, response.Email);
    }

    [Fact]
    public async Task Shall_return_unauthorized_when_subject_claim_is_not_a_guid()
    {
        // Arrange
        var controller = new AuthController(new FakeMagicLinkService(), _dbContext)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, "not-a-guid")],
                        "TestAuth"))
                }
            }
        };

        // Act
        var result = await controller.Me(CancellationToken.None);

        // Assert
        Assert.IsType<UnauthorizedResult>(result);
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
