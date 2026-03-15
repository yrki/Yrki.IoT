
using Core.Contexts;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("[controller]")]
    public class LocationsController : ControllerBase
    {
        private readonly DatabaseContext _databaseContext;

        public LocationsController(DatabaseContext databaseContext)
        {
            _databaseContext = databaseContext;
        }
    }
}
