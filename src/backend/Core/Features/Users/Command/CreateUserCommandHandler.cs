using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Users.Command;

public class CreateUserCommandHandler(DatabaseContext db, ILogger<CreateUserCommandHandler> logger)
{
    public async Task<UserResponse?> HandleAsync(
        CreateUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = UserEmailNormalizer.Normalize(request.Email);
        var existingUser = await db.Users
            .AsNoTracking()
            .AnyAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);

        if (existingUser)
        {
            logger.LogWarning("User with email {Email} already exists", request.Email);
            return null;
        }

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            Email = request.Email.Trim(),
            NormalizedEmail = normalizedEmail,
            CreatedAtUtc = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Created user {Email} with id {UserId}", user.Email, user.Id);
        return new UserResponse(user.Id, user.Email, user.CreatedAtUtc, user.LastLoginAtUtc);
    }
}
