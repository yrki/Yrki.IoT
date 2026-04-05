using System.ComponentModel.DataAnnotations;

namespace Contracts.Requests;

public record CreateUserRequest([Required, EmailAddress] string Email);
