using Contracts.Requests;
using Core.Features.EncryptionKeys.Command;
using Core.Features.EncryptionKeys.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class EncryptionKeysController(
    EncryptionKeysQueryHandler queryHandler,
    CreateEncryptionKeyCommandHandler createHandler,
    UpdateEncryptionKeyCommandHandler updateHandler,
    DeleteEncryptionKeyCommandHandler deleteHandler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var keys = await queryHandler.HandleAsync(cancellationToken);
        return Ok(keys);
    }

    [HttpGet("device/{deviceUniqueId}")]
    public async Task<IActionResult> GetByDevice(
        string deviceUniqueId,
        [FromQuery] string? manufacturer,
        CancellationToken cancellationToken)
    {
        var key = await queryHandler.HandleByDeviceAsync(deviceUniqueId, manufacturer, cancellationToken);
        if (key is null)
            return NotFound();

        return Ok(key);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateEncryptionKeyRequest request,
        CancellationToken cancellationToken)
    {
        var key = await createHandler.HandleAsync(request, cancellationToken);
        return Created($"/encryptionkeys/{key.Id}", key);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateEncryptionKeyRequest request,
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
