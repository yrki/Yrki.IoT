using Contracts.Requests;
using Core.Features.Locations.Command;
using Core.Features.Locations.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class LocationsController(
    LocationsQueryHandler queryHandler,
    CreateLocationCommandHandler createHandler,
    UpdateLocationCommandHandler updateHandler,
    DeleteLocationCommandHandler deleteHandler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var locations = await queryHandler.HandleAsync(cancellationToken);
        return Ok(locations);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateLocationRequest request,
        CancellationToken cancellationToken)
    {
        var location = await createHandler.HandleAsync(request, cancellationToken);
        return Created($"/locations/{location.Id}", location);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateLocationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await updateHandler.HandleAsync(id, request, cancellationToken);
        if (result is null)
            return NotFound();

        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await deleteHandler.HandleAsync(id, cancellationToken);
        if (!deleted)
            return NotFound();

        return NoContent();
    }
}
