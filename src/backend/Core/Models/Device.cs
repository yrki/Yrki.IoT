using System.ComponentModel.DataAnnotations;

namespace Core.Models;

public class Device
{
    [Key]
    public Guid Id { get; set; }

    public required string UniqueId { get; set; }

    public string? Name { get; set; }
    public string Type { get; set; } = string.Empty;
    public required string Description { get; set; }

    public string? Manufacturer { get; set; }
    public DeviceKind Kind { get; set; } = DeviceKind.Sensor;
    public bool IsNew { get; set; }
    public bool IsDeleted { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }
    public DateTimeOffset LastContact { get; set; }
    public DateTimeOffset InstallationDate { get; set; }
}
