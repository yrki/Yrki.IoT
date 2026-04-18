using Core.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Features.Users.Command;

public class DeleteUserCommandHandler(DatabaseContext db, ILogger<DeleteUserCommandHandler> logger)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (user is null)
        {
            logger.LogWarning("User {UserId} not found", id);
            return false;
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Deleted user {UserId}", id);
        return true;
    }
}
