using Core.Contexts;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

        [HttpGet("location/{locationId}")]
        [ProducesResponseType(200)]
        public async Task<IActionResult> GetByLocation(Guid locationId)
        {

            throw new NotImplementedException();
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<global::Contracts.Device>> GetById([FromRoute]string id)
        {
            return Ok(new global::Contracts.Device
            {
                Id = Guid.NewGuid(),
                UniqueId = "123456"
            });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] global::Contracts.Device device)
        {

            throw new NotImplementedException();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {

            throw new NotImplementedException();
        }
    }
}
