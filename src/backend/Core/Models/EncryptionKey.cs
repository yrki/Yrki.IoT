using System.ComponentModel.DataAnnotations;

namespace Core.Models;

public class EncryptionKey
{
    [Key]
    public Guid Id { get; set; }

    public string? Manufacturer { get; set; }

    public string? DeviceUniqueId { get; set; }

    public string? GroupName { get; set; }

    public required string EncryptedKeyValue { get; set; }

    public string? Description { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
