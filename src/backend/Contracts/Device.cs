namespace Contracts;

public class Device
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public required string UniqueId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string? Manufacturer { get; set; }
    public bool IsNew { get; set; }

    public Guid? LocationId { get; set; }
    public required string Description { get; set; }
    public DateTimeOffset LastContact { get; set; }
    public DateTimeOffset InstallationDate { get; set; }
}
