using System.ComponentModel.DataAnnotations;

namespace Core.Models;

public class Building
{
    [Key]
    public Guid Id { get; set; }

    public required string Name { get; set; }
    public string? Address { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }

    /// <summary>
    /// Filename of the uploaded IFC model, stored under the uploads directory.
    /// Null when no model has been uploaded.
    /// </summary>
    public string? IfcFileName { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public List<Device> Devices { get; set; } = [];
}
