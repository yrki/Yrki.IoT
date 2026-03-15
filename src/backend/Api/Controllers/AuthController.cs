using Api.Contracts.Auth;
using Api.Services;
using Core.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly IMagicLinkService _magicLinkService;
    private readonly DatabaseContext _databaseContext;

    public AuthController(IMagicLinkService magicLinkService, DatabaseContext databaseContext)
    {
        _magicLinkService = magicLinkService;
        _databaseContext = databaseContext;
    }

    [AllowAnonymous]
    [HttpPost("magic-link")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> RequestMagicLink([FromBody] MagicLinkRequest request, CancellationToken cancellationToken)
    {
        await _magicLinkService.RequestAsync(request.Email, cancellationToken);
        return Accepted();
    }

    [AllowAnonymous]
    [HttpPost("verify")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> VerifyMagicLink([FromBody] MagicLinkVerifyRequest request, CancellationToken cancellationToken)
    {
        var response = await _magicLinkService.VerifyAsync(request.Token, cancellationToken);
        return response is null ? Unauthorized() : Ok(response);
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var subject = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(subject, out var userId))
        {
            return Unauthorized();
        }

        var user = await _databaseContext.Users
            .Where(candidate => candidate.Id == userId)
            .Select(candidate => new CurrentUserResponse
            {
                Id = candidate.Id,
                Email = candidate.Email
            })
            .FirstOrDefaultAsync(cancellationToken);

        return user is null ? Unauthorized() : Ok(user);
    }
}
