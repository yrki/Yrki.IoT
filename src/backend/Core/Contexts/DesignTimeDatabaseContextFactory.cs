using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Core.Contexts;

public class DesignTimeDatabaseContextFactory : IDesignTimeDbContextFactory<DatabaseContext>
{
    public DatabaseContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseNpgsql("Host=localhost;Database=YrkiIoT;Username=postgres;Password=postgres")
            .Options;

        return new DatabaseContext(options);
    }
}
