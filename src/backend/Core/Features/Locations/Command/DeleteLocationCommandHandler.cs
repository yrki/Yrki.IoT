using Core.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Core.Features.Locations.Command;

public class DeleteLocationCommandHandler(DatabaseContext db)
{
    public async Task<bool> HandleAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var location = await db.Locations.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
        if (location is null)
            return false;

        db.Locations.Remove(location);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
