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

    /// <summary>
    /// Polygon boundary stored as JSON array of [longitude, latitude] pairs.
    /// Null when the location has no drawn area.
    /// </summary>
    public string? Boundary { get; set; }

    /// <summary>
    /// Optional CSS color (e.g. "#3b82f6") used when rendering the location's polygon.
    /// Null falls back to a derived hue based on the location id.
    /// </summary>
    public string? Color { get; set; }

    public Guid? ParentLocationId { get; set; }
    public Location? ParentLocation { get; set; }

    public List<Location> Children { get; set; } = [];
    public List<Device> Devices { get; set; } = [];
}
