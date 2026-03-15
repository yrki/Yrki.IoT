using System.ComponentModel.DataAnnotations;

namespace Api.Contracts.Auth;

public class MagicLinkVerifyRequest
{
    [Required]
    public string Token { get; set; } = string.Empty;
}
