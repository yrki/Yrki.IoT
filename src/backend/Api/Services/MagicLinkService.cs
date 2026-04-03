using Api.Configuration;
using Api.Contracts.Auth;
using Core.Contexts;
using Core.Models;
using Core.Services.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Api.Services;

public class MagicLinkService : IMagicLinkService
{
    private readonly DatabaseContext _databaseContext;
    private readonly ITokenHasher _tokenHasher;
    private readonly IEmailService _emailService;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly MagicLinkOptions _options;

    public MagicLinkService(
        DatabaseContext databaseContext,
        ITokenHasher tokenHasher,
        IEmailService emailService,
        IJwtTokenService jwtTokenService,
        IOptions<MagicLinkOptions> options)
    {
        _databaseContext = databaseContext;
        _tokenHasher = tokenHasher;
        _emailService = emailService;
        _jwtTokenService = jwtTokenService;
        _options = options.Value;
    }

    public async Task RequestAsync(string email, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToUpperInvariant();
        var user = await _databaseContext.Users
            .FirstOrDefaultAsync(candidate => candidate.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user is null)
            return;

        var activeTokens = await _databaseContext.MagicLinkTokens
            .Where(token => token.UserId == user.Id && token.UsedAtUtc == null && token.ExpiresAtUtc > DateTime.UtcNow)
            .ToListAsync(cancellationToken);

        foreach (var activeToken in activeTokens)
        {
            activeToken.UsedAtUtc = DateTime.UtcNow;
        }

        var rawToken = $"{Guid.NewGuid():N}{Guid.NewGuid():N}";
        var magicLinkToken = new MagicLinkToken
        {
            Id = Guid.NewGuid(),
            User = user,
            TokenHash = _tokenHasher.Hash(rawToken),
            CreatedAtUtc = DateTime.UtcNow,
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(_options.TokenLifetimeMinutes)
        };

        _databaseContext.MagicLinkTokens.Add(magicLinkToken);
        await _databaseContext.SaveChangesAsync(cancellationToken);

        var url = $"{_options.FrontendBaseUrl.TrimEnd('/')}/auth/callback?token={Uri.EscapeDataString(rawToken)}";
        await _emailService.SendAsync(
            user.Email,
            "Your Yrki IoT sign-in link",
            $"Use this link to sign in to Yrki IoT: {url}",
            cancellationToken);
    }

    public async Task<AuthResponse?> VerifyAsync(string token, CancellationToken cancellationToken)
    {
        var tokenHash = _tokenHasher.Hash(token);
        var magicLinkToken = await _databaseContext.MagicLinkTokens
            .Include(candidate => candidate.User)
            .FirstOrDefaultAsync(candidate => candidate.TokenHash == tokenHash, cancellationToken);

        if (magicLinkToken is null || magicLinkToken.UsedAtUtc is not null || magicLinkToken.ExpiresAtUtc <= DateTime.UtcNow)
        {
            return null;
        }

        magicLinkToken.UsedAtUtc = DateTime.UtcNow;
        magicLinkToken.User.LastLoginAtUtc = DateTime.UtcNow;
        await _databaseContext.SaveChangesAsync(cancellationToken);

        var (jwt, expiresAtUtc) = _jwtTokenService.CreateToken(magicLinkToken.User);
        return new AuthResponse
        {
            AccessToken = jwt,
            ExpiresAtUtc = expiresAtUtc,
            User = new CurrentUserResponse
            {
                Id = magicLinkToken.User.Id,
                Email = magicLinkToken.User.Email
            }
        };
    }
}
