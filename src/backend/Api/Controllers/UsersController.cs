using Contracts.Requests;
using Core.Features.Users.Command;
using Core.Features.Users.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class UsersController(
    UsersQueryHandler queryHandler,
    CreateUserCommandHandler createHandler,
    UpdateUserCommandHandler updateHandler,
    DeleteUserCommandHandler deleteHandler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var users = await queryHandler.HandleAsync(cancellationToken);
        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var user = await createHandler.HandleAsync(request, cancellationToken);
        if (user is null)
        {
            return Conflict();
        }

        return Created($"/users/{user.Id}", user);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateUserRequest request,
        CancellationToken cancellationToken)
    {
        var result = await updateHandler.HandleAsync(id, request, cancellationToken);
        if (result.User is null && !result.DuplicateEmail)
        {
            return NotFound();
        }

        if (result.DuplicateEmail)
        {
            return Conflict();
        }

        return Ok(result.User);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await deleteHandler.HandleAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }
}
