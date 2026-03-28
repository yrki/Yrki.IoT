using System.ComponentModel.DataAnnotations;

using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace Core.Models;

public class Tennant
{
    [Key]
    public Guid Id { get; set; }

    public string Name { get; set; }

}
