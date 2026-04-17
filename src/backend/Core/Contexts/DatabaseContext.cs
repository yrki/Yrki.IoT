using Core.Models;

using Microsoft.EntityFrameworkCore;

namespace Core.Contexts;

public class DatabaseContext : DbContext
{
    public DatabaseContext(DbContextOptions<DatabaseContext> options) : base(options)
    {
    }

    public DbSet<Device> Devices { get; set; }
    public DbSet<Location> Locations { get; set; }
    public DbSet<AppUser> Users { get; set; }
    public DbSet<MagicLinkToken> MagicLinkTokens { get; set; }
    public DbSet<SensorReading> SensorReadings { get; set; }
    public DbSet<EncryptionKey> EncryptionKeys { get; set; }
    public DbSet<RawPayload> RawPayloads { get; set; }
    public DbSet<GatewayReading> GatewayReadings { get; set; }
    public DbSet<GatewayPosition> GatewayPositions { get; set; }
    public DbSet<Building> Buildings { get; set; }
    public DbSet<Floor> Floors { get; set; }
    public DbSet<Room> Rooms { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Device>(entity =>
        {
            entity.ToTable("Devices");
            entity.HasKey(device => device.Id);
            entity.Property(device => device.UniqueId).IsRequired();
            entity.Property(device => device.Kind)
                .HasConversion<string>()
                .IsRequired();
            entity.Property(device => device.Description).IsRequired();
            entity.Property(device => device.Type).IsRequired();
            entity.HasOne(device => device.Location)
                .WithMany(location => location.Devices)
                .HasForeignKey(device => device.LocationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<Location>(entity =>
        {
            entity.ToTable("Locations");
            entity.HasKey(location => location.Id);
            entity.Property(location => location.Name).IsRequired();
            entity.Property(location => location.Description).IsRequired();
            entity.HasOne(location => location.ParentLocation)
                .WithMany(location => location.Children)
                .HasForeignKey(location => location.ParentLocationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(user => user.Id);
            entity.Property(user => user.Email).IsRequired();
            entity.Property(user => user.NormalizedEmail).IsRequired();
            entity.HasIndex(user => user.NormalizedEmail).IsUnique();
        });
        modelBuilder.Entity<MagicLinkToken>(entity =>
        {
            entity.ToTable("MagicLinkTokens");
            entity.HasKey(token => token.Id);
            entity.Property(token => token.TokenHash).IsRequired();
            entity.HasIndex(token => token.TokenHash).IsUnique();
            entity.HasOne(token => token.User)
                .WithMany(user => user.MagicLinkTokens)
                .HasForeignKey(token => token.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<EncryptionKey>(entity =>
        {
            entity.ToTable("EncryptionKeys");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EncryptedKeyValue).IsRequired();
            entity.HasIndex(e => new { e.Manufacturer, e.DeviceUniqueId });
            entity.HasIndex(e => e.Manufacturer);
            entity.HasIndex(e => e.DeviceUniqueId);
            entity.HasIndex(e => e.GroupName);
        });
        modelBuilder.Entity<RawPayload>(entity =>
        {
            entity.ToTable("raw_payloads");
            entity.HasKey(r => r.Id);
            entity.Property(r => r.ReceivedAt).HasColumnName("received_at");
            entity.Property(r => r.PayloadHex).HasColumnName("payload_hex").IsRequired();
            entity.Property(r => r.Source).HasColumnName("source").IsRequired();
            entity.Property(r => r.DeviceId).HasColumnName("device_id");
            entity.Property(r => r.Manufacturer).HasColumnName("manufacturer");
            entity.Property(r => r.GatewayId).HasColumnName("gateway_id");
            entity.Property(r => r.Rssi).HasColumnName("rssi");
            entity.Property(r => r.Error).HasColumnName("error");
            entity.HasIndex(r => r.ReceivedAt);
            entity.HasIndex(r => r.DeviceId);
        });
        modelBuilder.Entity<SensorReading>(entity =>
        {
            entity.ToTable("sensor_readings");
            entity.HasKey(r => new { r.Timestamp, r.SensorId, r.SensorType });
            entity.Property(r => r.Timestamp).HasColumnName("timestamp");
            entity.Property(r => r.SensorId).HasColumnName("sensor_id").IsRequired();
            entity.Property(r => r.SensorType).HasColumnName("sensor_type").IsRequired();
            entity.Property(r => r.Manufacturer).HasColumnName("manufacturer");
            entity.Property(r => r.GatewayId).HasColumnName("gateway_id");
            entity.Property(r => r.Rssi).HasColumnName("rssi");
            entity.Property(r => r.Value).HasColumnName("value");
            entity.HasIndex(r => r.GatewayId);
        });
        modelBuilder.Entity<GatewayReading>(entity =>
        {
            entity.ToTable("gateway_readings");
            entity.HasKey(r => r.Id);
            entity.Property(r => r.GatewayUniqueId).HasColumnName("gateway_unique_id").IsRequired();
            entity.Property(r => r.SensorUniqueId).HasColumnName("sensor_unique_id").IsRequired();
            entity.Property(r => r.Rssi).HasColumnName("rssi");
            entity.Property(r => r.ReceivedAt).HasColumnName("received_at");
            entity.HasIndex(r => r.GatewayUniqueId);
            entity.HasIndex(r => r.SensorUniqueId);
            entity.HasIndex(r => r.ReceivedAt);
        });
        modelBuilder.Entity<GatewayPosition>(entity =>
        {
            entity.ToTable("gateway_positions");
            entity.HasKey(r => new { r.Timestamp, r.GatewayUniqueId });
            entity.Property(r => r.Timestamp).HasColumnName("timestamp");
            entity.Property(r => r.GatewayUniqueId).HasColumnName("gateway_unique_id").IsRequired();
            entity.Property(r => r.Longitude).HasColumnName("longitude");
            entity.Property(r => r.Latitude).HasColumnName("latitude");
            entity.Property(r => r.Heading).HasColumnName("heading");
            entity.Property(r => r.DriveBy).HasColumnName("drive_by");
            entity.HasIndex(r => r.GatewayUniqueId);
            entity.HasIndex(r => r.DriveBy);
        });
    }
}
