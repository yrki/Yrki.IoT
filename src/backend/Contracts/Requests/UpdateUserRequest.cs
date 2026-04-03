using System.ComponentModel.DataAnnotations;

namespace Contracts.Requests;

public record UpdateUserRequest([property: Required, EmailAddress] string Email);
