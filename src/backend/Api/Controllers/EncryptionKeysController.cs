using Core.Contexts;
using Core.Models;
using Core.Services.Encryption;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers;

[ApiController]
[Route("[controller]")]
public class EncryptionKeysController(DatabaseContext db, IKeyEncryptionService encryptionService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var keys = await db.EncryptionKeys
            .AsNoTracking()
            .OrderBy(k => k.DeviceUniqueId)
            .ThenBy(k => k.GroupName)
            .Select(k => new
            {
                k.Id,
                k.DeviceUniqueId,
                k.GroupName,
                k.Description,
                k.CreatedAt,
                k.UpdatedAt,
            })
            .ToListAsync(cancellationToken);

        return Ok(keys);
    }

    [HttpGet("device/{deviceUniqueId}")]
    public async Task<IActionResult> GetByDevice(string deviceUniqueId, CancellationToken cancellationToken)
    {
        var key = await db.EncryptionKeys
            .AsNoTracking()
            .FirstOrDefaultAsync(k => k.DeviceUniqueId == deviceUniqueId, cancellationToken);

        if (key is null)
            return NotFound();

        return Ok(new
        {
            key.Id,
            key.DeviceUniqueId,
            key.GroupName,
            key.Description,
            key.CreatedAt,
            key.UpdatedAt,
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateEncryptionKeyRequest request,
        CancellationToken cancellationToken)
    {
        var encryptedValue = encryptionService.Encrypt(request.KeyValue);

        var key = new EncryptionKey
        {
            Id = Guid.NewGuid(),
            DeviceUniqueId = request.DeviceUniqueId,
            GroupName = request.GroupName,
            EncryptedKeyValue = encryptedValue,
            Description = request.Description,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.EncryptionKeys.Add(key);
        await db.SaveChangesAsync(cancellationToken);

        return Created($"/encryptionkeys/{key.Id}", new
        {
            key.Id,
            key.DeviceUniqueId,
            key.GroupName,
            key.Description,
            key.CreatedAt,
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateEncryptionKeyRequest request,
        CancellationToken cancellationToken)
    {
        var key = await db.EncryptionKeys.FirstOrDefaultAsync(k => k.Id == id, cancellationToken);
        if (key is null)
            return NotFound();

        if (request.KeyValue is not null)
            key.EncryptedKeyValue = encryptionService.Encrypt(request.KeyValue);

        key.DeviceUniqueId = request.DeviceUniqueId ?? key.DeviceUniqueId;
        key.GroupName = request.GroupName ?? key.GroupName;
        key.Description = request.Description ?? key.Description;
        key.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            key.Id,
            key.DeviceUniqueId,
            key.GroupName,
            key.Description,
            key.CreatedAt,
            key.UpdatedAt,
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var key = await db.EncryptionKeys.FirstOrDefaultAsync(k => k.Id == id, cancellationToken);
        if (key is null)
            return NotFound();

        db.EncryptionKeys.Remove(key);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

public record CreateEncryptionKeyRequest(
    string? DeviceUniqueId,
    string? GroupName,
    string KeyValue,
    string? Description);

public record UpdateEncryptionKeyRequest(
    string? DeviceUniqueId,
    string? GroupName,
    string? KeyValue,
    string? Description);
