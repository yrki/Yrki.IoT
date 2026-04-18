using Contracts.Requests;
using Contracts.Responses;
using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Users.Command;

public class UpdateUserCommandHandler(DatabaseContext db, ILogger<UpdateUserCommandHandler> logger)
{
    public async Task<UpdateUserCommandResult> HandleAsync(
        Guid id,
        UpdateUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        if (user is null)
        {
            logger.LogWarning("User {UserId} not found", id);
            return UpdateUserCommandResult.NotFound();
        }

        var normalizedEmail = UserEmailNormalizer.Normalize(request.Email);
        var duplicateEmailExists = await db.Users
            .AsNoTracking()
            .AnyAsync(candidate => candidate.Id != id && candidate.NormalizedEmail == normalizedEmail, cancellationToken);

        if (duplicateEmailExists)
        {
            logger.LogWarning("Duplicate email {Email} for user {UserId}", request.Email, id);
            return UpdateUserCommandResult.Conflict();
        }

        user.Email = request.Email.Trim();
        user.NormalizedEmail = normalizedEmail;

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Updated user {UserId}", id);
        return UpdateUserCommandResult.Success(
            new UserResponse(user.Id, user.Email, user.CreatedAtUtc, user.LastLoginAtUtc));
    }
}
