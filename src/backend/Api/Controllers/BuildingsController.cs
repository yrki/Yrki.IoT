using Contracts.Requests;
using Core.Features.Buildings.Command;
using Core.Features.Buildings.Query;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

    [HttpGet("{id:guid}/floors")]
    public async Task<IActionResult> GetFloors(Guid id, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var floors = await db.Floors
            .AsNoTracking()
            .Where(f => f.BuildingId == id)
            .OrderBy(f => f.SortOrder)
            .Select(f => new global::Contracts.Responses.FloorResponse(
                f.Id, f.Name, f.Elevation, f.SortOrder, f.BimExpressId, f.BuildingId,
                f.Rooms.OrderBy(r => r.SortOrder).ThenBy(r => r.Number ?? r.Name).Select(r => new global::Contracts.Responses.RoomResponse(
                    r.Id, r.Name, r.Number, r.SortOrder, r.BimExpressId, r.FloorId,
                    r.Devices.Count(d => !d.IsDeleted)
                )).ToList()))
            .ToListAsync(cancellationToken);
        return Ok(floors);
    }

    [HttpPost("{id:guid}/create-floor")]
    public async Task<IActionResult> CreateFloor(
        Guid id, [FromBody] CreateFloorRequest request, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        if (!await db.Buildings.AnyAsync(b => b.Id == id, cancellationToken)) return NotFound();

        var maxSort = await db.Floors.Where(f => f.BuildingId == id).MaxAsync(f => (int?)f.SortOrder, cancellationToken) ?? -1;
        var floor = new Core.Models.Floor
        {
            Id = Guid.NewGuid(), Name = request.Name, Elevation = request.Elevation,
            SortOrder = maxSort + 1, BuildingId = id,
        };
        db.Floors.Add(floor);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/buildings/{id}/floors",
            new global::Contracts.Responses.FloorResponse(floor.Id, floor.Name, floor.Elevation, floor.SortOrder, null, id, []));
    }

    [HttpPost("{id:guid}/floors/{floorId:guid}/create-room")]
    public async Task<IActionResult> CreateRoom(
        Guid id, Guid floorId, [FromBody] CreateRoomRequest request, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var floor = await db.Floors.FirstOrDefaultAsync(f => f.Id == floorId && f.BuildingId == id, cancellationToken);
        if (floor is null) return NotFound();

        var maxSort = await db.Rooms.Where(r => r.FloorId == floorId).MaxAsync(r => (int?)r.SortOrder, cancellationToken) ?? -1;
        var room = new Core.Models.Room { Id = Guid.NewGuid(), Name = request.Name, Number = request.Number, SortOrder = maxSort + 1, FloorId = floorId };
        db.Rooms.Add(room);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/buildings/{id}/floors",
            new global::Contracts.Responses.RoomResponse(room.Id, room.Name, room.Number, room.SortOrder, null, floorId, 0));
    }

    [HttpPut("{id:guid}/floors/{floorId:guid}")]
    public async Task<IActionResult> UpdateFloor(
        Guid id, Guid floorId, [FromBody] UpdateFloorRequest request, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var floor = await db.Floors.FirstOrDefaultAsync(f => f.Id == floorId && f.BuildingId == id, cancellationToken);
        if (floor is null) return NotFound();

        floor.Name = request.Name;
        floor.Elevation = request.Elevation;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new global::Contracts.Responses.FloorResponse(
            floor.Id, floor.Name, floor.Elevation, floor.SortOrder, floor.BimExpressId, floor.BuildingId, []));
    }

    [HttpDelete("{id:guid}/floors/{floorId:guid}")]
    public async Task<IActionResult> DeleteFloor(
        Guid id, Guid floorId, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var floor = await db.Floors
            .Include(f => f.Rooms).ThenInclude(r => r.Devices)
            .FirstOrDefaultAsync(f => f.Id == floorId && f.BuildingId == id, cancellationToken);
        if (floor is null) return NotFound();

        // Re-parent devices to building level
        foreach (var room in floor.Rooms)
        {
            foreach (var device in room.Devices.Where(d => !d.IsDeleted))
                device.RoomId = null;
            db.Rooms.Remove(room);
        }
        db.Floors.Remove(floor);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPut("{id:guid}/floors/{floorId:guid}/rooms/{roomId:guid}")]
    public async Task<IActionResult> UpdateRoom(
        Guid id, Guid floorId, Guid roomId, [FromBody] UpdateRoomRequest request, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var room = await db.Rooms.Include(r => r.Floor)
            .FirstOrDefaultAsync(r => r.Id == roomId && r.FloorId == floorId && r.Floor.BuildingId == id, cancellationToken);
        if (room is null) return NotFound();

        room.Name = request.Name;
        room.Number = request.Number;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new global::Contracts.Responses.RoomResponse(
            room.Id, room.Name, room.Number, room.SortOrder, room.BimExpressId, room.FloorId, 0));
    }

    [HttpDelete("{id:guid}/floors/{floorId:guid}/rooms/{roomId:guid}")]
    public async Task<IActionResult> DeleteRoom(
        Guid id, Guid floorId, Guid roomId, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var room = await db.Rooms.Include(r => r.Floor).Include(r => r.Devices)
            .FirstOrDefaultAsync(r => r.Id == roomId && r.FloorId == floorId && r.Floor.BuildingId == id, cancellationToken);
        if (room is null) return NotFound();

        foreach (var device in room.Devices.Where(d => !d.IsDeleted))
            device.RoomId = null;
        db.Rooms.Remove(room);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPut("{id:guid}/reorder-floors")]
    public async Task<IActionResult> ReorderFloors(
        Guid id, [FromBody] ReorderFloorsRequest request, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var floors = await db.Floors.Where(f => f.BuildingId == id).ToListAsync(cancellationToken);
        var lookup = floors.ToDictionary(f => f.Id);

        for (var i = 0; i < request.FloorIds.Count; i++)
        {
            if (lookup.TryGetValue(request.FloorIds[i], out var floor))
                floor.SortOrder = i;
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPut("{id:guid}/floors/{floorId:guid}/reorder-rooms")]
    public async Task<IActionResult> ReorderRooms(
        Guid id, Guid floorId, [FromBody] ReorderRoomsRequest request, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var rooms = await db.Rooms.Where(r => r.FloorId == floorId).ToListAsync(cancellationToken);
        var lookup = rooms.ToDictionary(r => r.Id);

        for (var i = 0; i < request.RoomIds.Count; i++)
        {
            if (lookup.TryGetValue(request.RoomIds[i], out var room))
                room.SortOrder = i;
        }
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    /// <summary>
    /// Compares the incoming IFC structure with existing floors/rooms.
    /// On first import (no floors yet), creates everything automatically.
    /// On subsequent imports, returns a diff for the user to confirm.
    /// </summary>
    [HttpPost("{id:guid}/import-structure")]
    public async Task<IActionResult> ImportStructure(
        Guid id, [FromBody] ImportBuildingStructureRequest request, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        if (!await db.Buildings.AnyAsync(b => b.Id == id, cancellationToken)) return NotFound();

        var existingFloors = await db.Floors
            .Include(f => f.Rooms).ThenInclude(r => r.Devices)
            .Where(f => f.BuildingId == id)
            .ToListAsync(cancellationToken);

        // First import — create everything, no diff needed
        if (existingFloors.Count == 0)
        {
            var sortOrder = 0;
            foreach (var fe in request.Floors)
            {
                var floor = new Core.Models.Floor
                {
                    Id = Guid.NewGuid(), Name = fe.Name, Elevation = fe.Elevation,
                    SortOrder = sortOrder++, BimExpressId = fe.BimExpressId, BuildingId = id,
                };
                db.Floors.Add(floor);
                foreach (var re in fe.Rooms)
                    db.Rooms.Add(new Core.Models.Room
                    {
                        Id = Guid.NewGuid(), Name = re.Name, Number = re.Number,
                        BimExpressId = re.BimExpressId, FloorId = floor.Id,
                    });
            }
            await db.SaveChangesAsync(cancellationToken);
            return Ok(new global::Contracts.Responses.BimStructureDiffResponse([], [], [], [], false));
        }

        // Compute diff based on BimExpressId
        var existFloorIds = existingFloors.Where(f => f.BimExpressId.HasValue).ToDictionary(f => f.BimExpressId!.Value);
        var existRoomIds = existingFloors.SelectMany(f => f.Rooms).Where(r => r.BimExpressId.HasValue).ToDictionary(r => r.BimExpressId!.Value);
        var incomFloorIds = request.Floors.Where(f => f.BimExpressId.HasValue).Select(f => f.BimExpressId!.Value).ToHashSet();
        var incomRoomIds = request.Floors.SelectMany(f => f.Rooms).Where(r => r.BimExpressId.HasValue).Select(r => r.BimExpressId!.Value).ToHashSet();

        var newFloors = request.Floors
            .Where(f => f.BimExpressId.HasValue && !existFloorIds.ContainsKey(f.BimExpressId.Value))
            .Select(f => new global::Contracts.Responses.BimDiffFloor(null, f.Name, f.Elevation, f.BimExpressId, f.Rooms.Count)).ToList();
        var removedFloors = existingFloors
            .Where(f => f.BimExpressId.HasValue && !incomFloorIds.Contains(f.BimExpressId.Value))
            .Select(f => new global::Contracts.Responses.BimDiffFloor(f.Id, f.Name, f.Elevation, f.BimExpressId, f.Rooms.Count)).ToList();
        var newRooms = request.Floors.SelectMany(f => f.Rooms
            .Where(r => r.BimExpressId.HasValue && !existRoomIds.ContainsKey(r.BimExpressId.Value))
            .Select(r => new global::Contracts.Responses.BimDiffRoom(null, r.Name, r.Number, r.BimExpressId, f.Name, 0))).ToList();
        var removedRooms = existingFloors.SelectMany(f => f.Rooms
            .Where(r => r.BimExpressId.HasValue && !incomRoomIds.Contains(r.BimExpressId.Value))
            .Select(r => new global::Contracts.Responses.BimDiffRoom(r.Id, r.Name, r.Number, r.BimExpressId, f.Name, r.Devices.Count(d => !d.IsDeleted)))).ToList();

        return Ok(new global::Contracts.Responses.BimStructureDiffResponse(
            newFloors, removedFloors, newRooms, removedRooms,
            newFloors.Count > 0 || removedFloors.Count > 0 || newRooms.Count > 0 || removedRooms.Count > 0));
    }

    /// <summary>
    /// Applies structure changes: creates new floors/rooms from IFC, and
    /// deletes removed ones (re-parenting devices to building level).
    /// </summary>
    [HttpPost("{id:guid}/apply-structure-changes")]
    public async Task<IActionResult> ApplyStructureChanges(
        Guid id,
        [FromBody] ImportBuildingStructureRequest request,
        [FromQuery] bool createNew = true,
        [FromQuery] bool deleteRemoved = true,
        CancellationToken cancellationToken = default)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        if (!await db.Buildings.AnyAsync(b => b.Id == id, cancellationToken)) return NotFound();

        var existingFloors = await db.Floors
            .Include(f => f.Rooms).ThenInclude(r => r.Devices)
            .Where(f => f.BuildingId == id)
            .ToListAsync(cancellationToken);

        var existFloorByBimId = existingFloors.Where(f => f.BimExpressId.HasValue).ToDictionary(f => f.BimExpressId!.Value);
        var existRoomByBimId = existingFloors.SelectMany(f => f.Rooms).Where(r => r.BimExpressId.HasValue).ToDictionary(r => r.BimExpressId!.Value);
        var incomFloorBimIds = request.Floors.Where(f => f.BimExpressId.HasValue).Select(f => f.BimExpressId!.Value).ToHashSet();
        var incomRoomBimIds = request.Floors.SelectMany(f => f.Rooms).Where(r => r.BimExpressId.HasValue).Select(r => r.BimExpressId!.Value).ToHashSet();

        // Create new floors and rooms
        if (createNew)
        {
            var maxSort = existingFloors.Count > 0 ? existingFloors.Max(f => f.SortOrder) : -1;
            foreach (var fe in request.Floors)
            {
                if (fe.BimExpressId.HasValue && existFloorByBimId.ContainsKey(fe.BimExpressId.Value))
                {
                    // Floor exists — check for new rooms
                    var existingFloor = existFloorByBimId[fe.BimExpressId.Value];
                    foreach (var re in fe.Rooms.Where(r => r.BimExpressId.HasValue && !existRoomByBimId.ContainsKey(r.BimExpressId!.Value)))
                    {
                        db.Rooms.Add(new Core.Models.Room
                        {
                            Id = Guid.NewGuid(), Name = re.Name, Number = re.Number,
                            BimExpressId = re.BimExpressId, FloorId = existingFloor.Id,
                        });
                    }
                }
                else if (fe.BimExpressId.HasValue)
                {
                    // New floor
                    var floor = new Core.Models.Floor
                    {
                        Id = Guid.NewGuid(), Name = fe.Name, Elevation = fe.Elevation,
                        SortOrder = ++maxSort, BimExpressId = fe.BimExpressId, BuildingId = id,
                    };
                    db.Floors.Add(floor);
                    foreach (var re in fe.Rooms)
                        db.Rooms.Add(new Core.Models.Room
                        {
                            Id = Guid.NewGuid(), Name = re.Name, Number = re.Number,
                            BimExpressId = re.BimExpressId, FloorId = floor.Id,
                        });
                }
            }
        }

        // Delete removed rooms — re-parent devices
        if (deleteRemoved)
        {
            foreach (var existRoom in existingFloors.SelectMany(f => f.Rooms))
            {
                if (existRoom.BimExpressId.HasValue && !incomRoomBimIds.Contains(existRoom.BimExpressId.Value))
                {
                    foreach (var device in existRoom.Devices.Where(d => !d.IsDeleted))
                        device.RoomId = null;
                    db.Rooms.Remove(existRoom);
                }
            }

            // Delete removed floors — re-parent devices
            foreach (var existFloor in existingFloors)
            {
                if (existFloor.BimExpressId.HasValue && !incomFloorBimIds.Contains(existFloor.BimExpressId.Value))
                {
                    foreach (var room in existFloor.Rooms.ToList())
                    {
                        foreach (var device in room.Devices.Where(d => !d.IsDeleted))
                            device.RoomId = null;
                        if (db.Entry(room).State != Microsoft.EntityFrameworkCore.EntityState.Deleted)
                            db.Rooms.Remove(room);
                    }
                    db.Floors.Remove(existFloor);
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { applied = true });
    }

    [HttpPost("{id:guid}/assign-device-to-room")]
    public async Task<IActionResult> AssignDeviceToRoom(
        Guid id, [FromBody] AssignDeviceToRoomRequest request, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var device = await db.Devices.FirstOrDefaultAsync(d => d.Id == request.DeviceId, cancellationToken);
        if (device is null) return NotFound();

        var room = await db.Rooms.Include(r => r.Floor)
            .FirstOrDefaultAsync(r => r.Id == request.RoomId && r.Floor.BuildingId == id, cancellationToken);
        if (room is null) return NotFound();

        device.RoomId = request.RoomId;
        device.BuildingId = id;
        device.BimX = request.BimX;
        device.BimY = request.BimY;
        device.BimZ = request.BimZ;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpGet("{id:guid}/devices")]
    public async Task<IActionResult> GetDevices(Guid id, CancellationToken cancellationToken)
    {
        var db = HttpContext.RequestServices.GetRequiredService<Core.Contexts.DatabaseContext>();
        var devices = await db.Devices
            .AsNoTracking()
            .Where(d => d.BuildingId == id && !d.IsDeleted)
            .OrderBy(d => d.UniqueId)
            .Select(d => new global::Contracts.Responses.BuildingDeviceResponse(
                d.Id, d.UniqueId, d.Name, d.Manufacturer, d.Type,
                d.Kind.ToString(), d.LastContact,
                d.BimX, d.BimY, d.BimZ, d.RoomId))
            .ToListAsync(cancellationToken);
        return Ok(devices);
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
        await updateHandler.HandleAsync(id, new UpdateBuildingRequest(null, null, null, null, null), cancellationToken);
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
