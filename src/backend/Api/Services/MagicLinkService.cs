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
        var plainText = $"Use this link to sign in to Yrki IoT: {url}";
        var html = BuildMagicLinkHtml(url);

        await _emailService.SendAsync(
            user.Email,
            "Your Yrki IoT sign-in link",
            plainText,
            html,
            cancellationToken);
    }

    private const string AsciiLogo =
        " __ __     _   _\n" +
        "|  |  |___| |_|_|\n" +
        "|_   _|  _| &#39;_| |\n" +
        "  |_| |_| |_,_|_|";

    private static string BuildMagicLinkHtml(string url)
    {
        var safeUrl = System.Net.WebUtility.HtmlEncode(url);
        return $"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#1e293b; border-radius:12px; border:1px solid rgba(255,255,255,0.08);">

        <!-- ASCII Logo -->
        <tr><td align="center" style="padding:36px 24px 8px;">
          <pre style="font-family:'Courier New',Courier,monospace; font-size:11px; line-height:1.2; color:#38bdf8; margin:0; letter-spacing:0.5px;">{AsciiLogo}</pre>
        </td></tr>

        <!-- Subtitle -->
        <tr><td align="center" style="padding:4px 24px 24px;">
          <span style="font-size:11px; color:#64748b; letter-spacing:3px; text-transform:uppercase;">sensors &middot; gateways &middot; dashboards</span>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px;">
          <div style="border-top:1px solid rgba(148,163,184,0.18); height:0;"></div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:28px 32px 8px; color:#e2e8f0; font-size:18px; font-weight:600;">
          Sign in to Yrki IoT
        </td></tr>

        <tr><td style="padding:0 32px 28px; color:#94a3b8; font-size:14px; line-height:1.6;">
          Click the button below to securely sign in to your dashboard. This link is valid for 15 minutes.
        </td></tr>

        <!-- CTA Button -->
        <tr><td align="center" style="padding:0 32px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td align="center" style="background:linear-gradient(135deg,#3b82f6,#2563eb); border-radius:8px;">
                <a href="{safeUrl}"
                   target="_blank"
                   style="display:inline-block; padding:14px 36px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none; letter-spacing:0.5px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  &#9656;&ensp;Sign in to Yrki
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Sensor decoration -->
        <tr><td align="center" style="padding:0 32px 8px;">
          <span style="font-family:'Courier New',Courier,monospace; font-size:11px; color:#334155; letter-spacing:2px;">&#8766; &#8766; &#8766; &#8766; &#8766; &#8766; &#8766; &#8766; &#8766;</span>
        </td></tr>

        <!-- Fallback link -->
        <tr><td style="padding:8px 32px 28px; color:#475569; font-size:12px; line-height:1.5; word-break:break-all;">
          If the button doesn't work, copy this link into your browser:<br />
          <a href="{safeUrl}" style="color:#38bdf8; text-decoration:underline;">{safeUrl}</a>
        </td></tr>

      </table>

      <!-- Footer -->
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">
        <tr><td align="center" style="padding:20px 24px; color:#475569; font-size:11px;">
          You received this email because someone requested a sign-in link for your Yrki IoT account. If this wasn't you, you can safely ignore it.
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>
""";
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
