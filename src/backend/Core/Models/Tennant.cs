using System.ComponentModel.DataAnnotations;

namespace Core.Models;

public class Tennant
{
    [Key]
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;
}
