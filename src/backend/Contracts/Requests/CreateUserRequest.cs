using System.ComponentModel.DataAnnotations;

namespace Contracts.Requests;

public record CreateUserRequest([property: Required, EmailAddress] string Email);
