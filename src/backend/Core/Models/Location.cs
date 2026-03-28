using System.ComponentModel.DataAnnotations;

namespace Core.Models;

public class Location
{
    [Key]
    public Guid Id { get; set; }

    public required string Name { get; set; }
    public required string Description { get; set; }
    public List<Device> Devices { get; set; } = [];
}
