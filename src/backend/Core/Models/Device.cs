using System.ComponentModel.DataAnnotations;

using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace Core.Models;

public class Device
{
    [Key]
    public Guid Id { get; set; }

    public string UniqueId { get; set; }

    public string Name { get; set; }
    public string Description { get; set; }

    public Guid LocationId { get; set; }
}
