using Api.Database.Entities;

using Microsoft.EntityFrameworkCore;

namespace Api.Database
{
    public class ApiDbContext : DbContext
    {
        public  ApiDbContext(DbContextOptions<ApiDbContext> options) : base(options)
        {
        }

        public DbSet<Device> Devices { get; set; }

        public DbSet<Location> Locations { get; set; }
        
        public DbSet<Owner> Owners { get; set; }
        
        public DbSet<User> Users { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<Device>()
                .HasOne(d => d.Owner);
            
            builder.Entity<User>()
                .HasOne(u => u.Owner);
        }
    }
}