using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Users.Command;

public class DeleteUserCommandHandler(DatabaseContext db)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (user is null)
        {
            return false;
        }

        db.Users.Remove(user);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
