using System.ComponentModel.DataAnnotations;

namespace Core.Models;

public class Floor
{
    [Key]
    public Guid Id { get; set; }

    public required string Name { get; set; }
    public double Elevation { get; set; }
    public int SortOrder { get; set; }

    /// <summary>
    /// Express ID from the IFC model (IFCBUILDINGSTOREY). Null for manually created floors.
    /// </summary>
    public int? BimExpressId { get; set; }

    public Guid BuildingId { get; set; }
    public Building Building { get; set; } = null!;

    public List<Room> Rooms { get; set; } = [];
}
