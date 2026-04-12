using Contracts.Requests;
using Core.Features.Buildings.Command;
using Core.Features.Buildings.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class BuildingsController(
    BuildingsQueryHandler queryHandler,
    CreateBuildingCommandHandler createHandler,
    UpdateBuildingCommandHandler updateHandler,
    DeleteBuildingCommandHandler deleteHandler,
    AssignDeviceToBuildingCommandHandler assignHandler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var buildings = await queryHandler.HandleAsync(cancellationToken);
        return Ok(buildings);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var building = await queryHandler.GetByIdAsync(id, cancellationToken);
        if (building is null) return NotFound();
        return Ok(building);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateBuildingRequest request,
        CancellationToken cancellationToken)
    {
        var building = await createHandler.HandleAsync(request, cancellationToken);
        return Created($"/buildings/{building.Id}", building);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateBuildingRequest request,
        CancellationToken cancellationToken)
    {
        var result = await updateHandler.HandleAsync(id, request, cancellationToken);
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await deleteHandler.HandleAsync(id, cancellationToken);
        if (!deleted) return NotFound();
        return NoContent();
    }

    [HttpPost("{id:guid}/upload-ifc")]
    [RequestSizeLimit(100_000_000)] // 100 MB
    public async Task<IActionResult> UploadIfc(
        Guid id,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        var building = await queryHandler.GetByIdAsync(id, cancellationToken);
        if (building is null) return NotFound();

        if (!file.FileName.EndsWith(".ifc", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Only .ifc files are accepted.");

        var uploadsDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "ifc");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{id}_{Guid.NewGuid():N}.ifc";
        var filePath = Path.Combine(uploadsDir, fileName);

        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        // Update building with filename
        await updateHandler.HandleAsync(id, new UpdateBuildingRequest(null, null, null, null), cancellationToken);
        // Direct DB update for IFC filename
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var entity = await db.Buildings.FindAsync([id], cancellationToken);
        if (entity is not null)
        {
            entity.IfcFileName = fileName;
            await db.SaveChangesAsync(cancellationToken);
        }

        return Ok(new { fileName });
    }

    [HttpGet("{id:guid}/ifc")]
    [AllowAnonymous]
    public async Task<IActionResult> DownloadIfc(Guid id, CancellationToken cancellationToken)
    {
        var building = await queryHandler.GetByIdAsync(id, cancellationToken);
        if (building?.IfcFileName is null) return NotFound();

        var filePath = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "ifc", building.IfcFileName);
        if (!System.IO.File.Exists(filePath)) return NotFound();

        return PhysicalFile(filePath, "application/octet-stream", $"{building.Name}.ifc");
    }

    [HttpPost("assign-device")]
    public async Task<IActionResult> AssignDevice(
        [FromBody] AssignDeviceToBuildingRequest request,
        CancellationToken cancellationToken)
    {
        var result = await assignHandler.HandleAsync(request, cancellationToken);
        if (!result) return NotFound();
        return Ok();
    }
}
