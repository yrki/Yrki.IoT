namespace Tests.Api.Fixtures;

public sealed class ApiDatabaseFixture
{
    public DatabaseContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<DatabaseContext>()
            .UseInMemoryDatabase($"api-tests-{Guid.NewGuid():N}")
            .EnableSensitiveDataLogging()
            .Options;

        var dbContext = new DatabaseContext(options);
        dbContext.Database.EnsureDeleted();
        dbContext.Database.EnsureCreated();
        return dbContext;
    }
}
