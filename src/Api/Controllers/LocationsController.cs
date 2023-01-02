using Api.Database;

using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    public class LocationsController : ControllerBase
    {
        private readonly ApiDbContext _dbContext;

        public LocationsController(ApiDbContext dbContext)
        {
            _dbContext = dbContext;
        }
    }
}