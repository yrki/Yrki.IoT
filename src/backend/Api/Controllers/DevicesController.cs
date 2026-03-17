using Api.Mappers;
using Core.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("[controller]")]
    public class DevicesController : ControllerBase
    {
        private readonly DatabaseContext _databaseContext;

        public DevicesController(DatabaseContext databaseContext)
        {
            _databaseContext = databaseContext;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<global::Contracts.Device>>> GetAll(CancellationToken cancellationToken)
        {
            var devices = await _databaseContext.Devices
                .AsNoTracking()
                .OrderBy(device => device.Name)
                .ThenBy(device => device.UniqueId)
                .ToListAsync(cancellationToken);

            return Ok(devices.MapToModel());
        }

        [HttpGet("location/{locationId}")]
        [ProducesResponseType(200)]
        public async Task<ActionResult<IEnumerable<global::Contracts.Device>>> GetByLocation(
            Guid locationId,
            CancellationToken cancellationToken)
        {
            var devices = await _databaseContext.Devices
                .AsNoTracking()
                .Where(device => device.LocationId == locationId)
                .OrderBy(device => device.Name)
                .ThenBy(device => device.UniqueId)
                .ToListAsync(cancellationToken);

            return Ok(devices.MapToModel());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<global::Contracts.Device>> GetById(
            [FromRoute] Guid id,
            CancellationToken cancellationToken)
        {
            var device = await _databaseContext.Devices
                .AsNoTracking()
                .SingleOrDefaultAsync(current => current.Id == id, cancellationToken);

            if (device is null)
            {
                return NotFound();
            }

            return Ok(device.MapToModel());
        }

        [HttpPost]
        public async Task<ActionResult<global::Contracts.Device>> Create(
            [FromBody] global::Contracts.Device device,
            CancellationToken cancellationToken)
        {
            var locationExists = await _databaseContext.Locations
                .AsNoTracking()
                .AnyAsync(location => location.Id == device.LocationId, cancellationToken);

            if (!locationExists)
            {
                ModelState.AddModelError(nameof(device.LocationId), "LocationId must reference an existing location.");
                return ValidationProblem(ModelState);
            }

            var entity = device.MapToEntity();

            _databaseContext.Devices.Add(entity);
            await _databaseContext.SaveChangesAsync(cancellationToken);

            return CreatedAtAction(nameof(GetById), new { id = entity.Id }, entity.MapToModel());
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
        {
            var device = await _databaseContext.Devices.SingleOrDefaultAsync(current => current.Id == id, cancellationToken);

            if (device is null)
            {
                return NotFound();
            }

            _databaseContext.Devices.Remove(device);
            await _databaseContext.SaveChangesAsync(cancellationToken);

            return NoContent();
        }
    }
}
