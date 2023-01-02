using Api.Database;
using Api.Database.Entities;
using Api.Mappers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Api.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class DevicesController : ControllerBase
    {
        private readonly ApiDbContext _dbContext;
        public DevicesController(ApiDbContext dbContext)
        {
            _dbContext = dbContext;

        }

        [HttpGet("location/{locationId}")]
        [ProducesResponseType(200)]
        public async Task<IActionResult> GetByLocation(Guid locationId)
        {
            var devices = await _dbContext.Devices.Where(d => d.Location != null && d.Location.Id == locationId)
                                                .ToListAsync();
            
            var devicesModel = devices.MapToModel();

            return Ok(devicesModel);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var device = await _dbContext.Devices.FindAsync(id);

            if (device == null)
            {
                return NotFound();
            }

            var deviceModel = device.MapToModel();

            return Ok(deviceModel);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Contracts.Device device)
        {
            var deviceEntity = new Device
            {
                Id = Guid.NewGuid(),
                UniqueId = device.UniqueId,
            };

            _dbContext.Devices.Add(deviceEntity);
            await _dbContext.SaveChangesAsync();

            var deviceModel = deviceEntity.MapToModel();

            return CreatedAtAction(nameof(GetById), new { id = deviceModel.Id }, deviceModel);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var device = await _dbContext.Devices.FindAsync(id);

            if (device == null)
            {
                return NotFound();
            }

            _dbContext.Devices.Remove(device);
            await _dbContext.SaveChangesAsync();

            return NoContent();
        }
    }
}