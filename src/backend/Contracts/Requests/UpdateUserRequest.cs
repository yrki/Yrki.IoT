using System.ComponentModel.DataAnnotations;

namespace Contracts.Requests;

public record UpdateUserRequest([Required, EmailAddress] string Email);
