using Core.Contexts;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class LocationsController(DatabaseContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var locations = await db.Locations
            .AsNoTracking()
            .OrderBy(l => l.Name)
            .Select(l => new { l.Id, l.Name, l.Description })
            .ToListAsync(cancellationToken);

        return Ok(locations);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateLocationRequest request,
        CancellationToken cancellationToken)
    {
        var location = new Core.Models.Location
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description ?? string.Empty,
        };

        db.Locations.Add(location);
        await db.SaveChangesAsync(cancellationToken);

        return Created($"/locations/{location.Id}", new { location.Id, location.Name, location.Description });
    }
}

public record CreateLocationRequest(string Name, string? Description);
