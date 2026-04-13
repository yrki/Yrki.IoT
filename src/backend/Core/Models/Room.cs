using System.ComponentModel.DataAnnotations;

namespace Core.Models;

public class Room
{
    [Key]
    public Guid Id { get; set; }

    public required string Name { get; set; }
    public string? Number { get; set; }

    public int SortOrder { get; set; }

    /// <summary>
    /// Express ID from the IFC model (IFCSPACE). Null for manually created rooms.
    /// </summary>
    public int? BimExpressId { get; set; }

    public Guid FloorId { get; set; }
    public Floor Floor { get; set; } = null!;

    public List<Device> Devices { get; set; } = [];
}
