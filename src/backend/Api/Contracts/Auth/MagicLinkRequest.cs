using System.ComponentModel.DataAnnotations;

namespace Api.Contracts.Auth;

public class MagicLinkRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}
