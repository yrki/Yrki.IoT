
using Core.Contexts;

using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers
{
    public class LocationsController : ControllerBase
    {
        private readonly DatabaseContext _databaseContext;

        public LocationsController(DatabaseContext databaseContext)
        {
            _databaseContext = databaseContext;
        }
    }
}