using System.ComponentModel.DataAnnotations;

namespace Core.Models;

public class Location
{
    [Key]
    public Guid Id { get; set; }

    public required string Name { get; set; }
    public required string Description { get; set; }

    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    public Guid? ParentLocationId { get; set; }
    public Location? ParentLocation { get; set; }

    public List<Location> Children { get; set; } = [];
    public List<Device> Devices { get; set; } = [];
}
