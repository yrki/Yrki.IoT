using Core.Models;

namespace Tests.Api.BuildingsControllerTests;

public sealed class BuildingsControllerTests_Floors : IClassFixture<ApiDatabaseFixture>, IDisposable
{
    private readonly DatabaseContext _dbContext;

    public BuildingsControllerTests_Floors(ApiDatabaseFixture fixture)
    {
        _dbContext = fixture.CreateDbContext();
    }

    private Building CreateTestBuilding()
    {
        var building = new Building
        {
            Id = Guid.NewGuid(),
            Name = "Test Building",
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };
        _dbContext.Buildings.Add(building);
        _dbContext.SaveChanges();
        return building;
    }

    [Fact]
    public async Task Shall_create_floor_and_return_it()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = "Level 1",
            Elevation = 0,
            SortOrder = 0,
            BuildingId = building.Id,
        };
        _dbContext.Floors.Add(floor);
        await _dbContext.SaveChangesAsync();

        // Act
        var floors = await _dbContext.Floors
            .Where(f => f.BuildingId == building.Id)
            .ToListAsync();

        // Assert
        Assert.Single(floors);
        Assert.Equal("Level 1", floors[0].Name);
        Assert.Equal(building.Id, floors[0].BuildingId);
    }

    [Fact]
    public async Task Shall_create_room_under_floor()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = "Level 1",
            Elevation = 0,
            SortOrder = 0,
            BuildingId = building.Id,
        };
        _dbContext.Floors.Add(floor);

        var room = new Room
        {
            Id = Guid.NewGuid(),
            Name = "Reception",
            Number = "1A01",
            FloorId = floor.Id,
        };
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();

        // Act
        var rooms = await _dbContext.Rooms
            .Where(r => r.FloorId == floor.Id)
            .ToListAsync();

        // Assert
        Assert.Single(rooms);
        Assert.Equal("Reception", rooms[0].Name);
        Assert.Equal("1A01", rooms[0].Number);
    }

    [Fact]
    public async Task Shall_assign_device_to_room()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = "Level 1",
            Elevation = 0,
            SortOrder = 0,
            BuildingId = building.Id,
        };
        _dbContext.Floors.Add(floor);

        var room = new Room
        {
            Id = Guid.NewGuid(),
            Name = "Office",
            Number = "1A02",
            FloorId = floor.Id,
        };
        _dbContext.Rooms.Add(room);

        var device = ApiTestData.CreateDevice("sensor-room-1", "Office sensor", "CO2", "");
        _dbContext.Devices.Add(device);
        await _dbContext.SaveChangesAsync();

        // Act
        device.RoomId = room.Id;
        device.BuildingId = building.Id;
        await _dbContext.SaveChangesAsync();

        // Assert
        var loaded = await _dbContext.Devices.SingleAsync(d => d.UniqueId == "sensor-room-1");
        Assert.Equal(room.Id, loaded.RoomId);
        Assert.Equal(building.Id, loaded.BuildingId);
    }

    [Fact]
    public async Task Shall_create_floor_with_bim_express_id()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = "Level 1",
            Elevation = 3.5,
            SortOrder = 0,
            BimExpressId = 872,
            BuildingId = building.Id,
        };
        _dbContext.Floors.Add(floor);
        await _dbContext.SaveChangesAsync();

        // Act
        var loaded = await _dbContext.Floors.SingleAsync(f => f.BuildingId == building.Id);

        // Assert
        Assert.Equal(872, loaded.BimExpressId);
        Assert.Equal(3.5, loaded.Elevation);
    }

    [Fact]
    public async Task Shall_create_room_with_bim_express_id()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor
        {
            Id = Guid.NewGuid(),
            Name = "Level 1",
            Elevation = 0,
            SortOrder = 0,
            BuildingId = building.Id,
        };
        _dbContext.Floors.Add(floor);

        var room = new Room
        {
            Id = Guid.NewGuid(),
            Name = "CORRIDOR",
            Number = "1AC2",
            BimExpressId = 872,
            FloorId = floor.Id,
        };
        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync();

        // Act
        var loaded = await _dbContext.Rooms.SingleAsync(r => r.FloorId == floor.Id);

        // Assert
        Assert.Equal(872, loaded.BimExpressId);
        Assert.Equal("1AC2", loaded.Number);
    }

    [Fact]
    public async Task Shall_import_structure_with_floors_and_rooms()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floors = new List<Core.Models.Floor>
        {
            new() { Id = Guid.NewGuid(), Name = "Level 1", Elevation = 0, SortOrder = 0, BimExpressId = 100, BuildingId = building.Id },
            new() { Id = Guid.NewGuid(), Name = "Level 2", Elevation = 3.5, SortOrder = 1, BimExpressId = 200, BuildingId = building.Id },
        };
        var rooms = new List<Core.Models.Room>
        {
            new() { Id = Guid.NewGuid(), Name = "Reception", Number = "1A01", BimExpressId = 101, FloorId = floors[0].Id },
            new() { Id = Guid.NewGuid(), Name = "Office", Number = "1A02", BimExpressId = 102, FloorId = floors[0].Id },
            new() { Id = Guid.NewGuid(), Name = "Lab", Number = "2A01", BimExpressId = 201, FloorId = floors[1].Id },
        };
        _dbContext.Floors.AddRange(floors);
        _dbContext.Rooms.AddRange(rooms);
        await _dbContext.SaveChangesAsync();

        // Act
        var loadedFloors = await _dbContext.Floors
            .Include(f => f.Rooms)
            .Where(f => f.BuildingId == building.Id)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();

        // Assert
        Assert.Equal(2, loadedFloors.Count);
        Assert.Equal("Level 1", loadedFloors[0].Name);
        Assert.Equal(100, loadedFloors[0].BimExpressId);
        Assert.Equal(2, loadedFloors[0].Rooms.Count);
        Assert.Equal("Level 2", loadedFloors[1].Name);
        Assert.Single(loadedFloors[1].Rooms);
    }

    [Fact]
    public async Task Shall_reassign_devices_when_room_deleted()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor { Id = Guid.NewGuid(), Name = "Level 1", Elevation = 0, SortOrder = 0, BuildingId = building.Id };
        _dbContext.Floors.Add(floor);
        var room = new Room { Id = Guid.NewGuid(), Name = "Old Room", Number = "1X01", BimExpressId = 999, FloorId = floor.Id };
        _dbContext.Rooms.Add(room);
        var device = ApiTestData.CreateDevice("sensor-orphan", "Orphan sensor", "CO2", "");
        device.RoomId = room.Id;
        device.BuildingId = building.Id;
        _dbContext.Devices.Add(device);
        await _dbContext.SaveChangesAsync();

        // Act
        device.RoomId = null;
        _dbContext.Rooms.Remove(room);
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.Devices.SingleAsync(d => d.UniqueId == "sensor-orphan");
        Assert.Null(result.RoomId);
        Assert.Equal(building.Id, result.BuildingId);
    }

    [Fact]
    public async Task Shall_reassign_devices_when_floor_deleted()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor { Id = Guid.NewGuid(), Name = "Old Level", Elevation = 0, SortOrder = 0, BimExpressId = 888, BuildingId = building.Id };
        _dbContext.Floors.Add(floor);
        var room = new Room { Id = Guid.NewGuid(), Name = "Room", FloorId = floor.Id };
        _dbContext.Rooms.Add(room);
        var device = ApiTestData.CreateDevice("sensor-floor-orphan", "Floor orphan", "Temperature", "");
        device.RoomId = room.Id;
        device.BuildingId = building.Id;
        _dbContext.Devices.Add(device);
        await _dbContext.SaveChangesAsync();

        // Act
        device.RoomId = null;
        _dbContext.Rooms.Remove(room);
        _dbContext.Floors.Remove(floor);
        await _dbContext.SaveChangesAsync();

        // Assert
        var result = await _dbContext.Devices.SingleAsync(d => d.UniqueId == "sensor-floor-orphan");
        Assert.Null(result.RoomId);
        Assert.Equal(building.Id, result.BuildingId);
        Assert.Empty(await _dbContext.Floors.Where(f => f.BuildingId == building.Id).ToListAsync());
    }

    [Fact]
    public async Task Shall_preserve_room_sort_order()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor { Id = Guid.NewGuid(), Name = "Level 1", Elevation = 0, SortOrder = 0, BuildingId = building.Id };
        _dbContext.Floors.Add(floor);

        var room1 = new Room { Id = Guid.NewGuid(), Name = "Room A", SortOrder = 0, FloorId = floor.Id };
        var room2 = new Room { Id = Guid.NewGuid(), Name = "Room B", SortOrder = 1, FloorId = floor.Id };
        var room3 = new Room { Id = Guid.NewGuid(), Name = "Room C", SortOrder = 2, FloorId = floor.Id };
        _dbContext.Rooms.AddRange(room1, room2, room3);
        await _dbContext.SaveChangesAsync();

        // Act — reorder: C, A, B
        room3.SortOrder = 0;
        room1.SortOrder = 1;
        room2.SortOrder = 2;
        await _dbContext.SaveChangesAsync();

        // Assert
        var rooms = await _dbContext.Rooms
            .Where(r => r.FloorId == floor.Id)
            .OrderBy(r => r.SortOrder)
            .ToListAsync();
        Assert.Equal("Room C", rooms[0].Name);
        Assert.Equal("Room A", rooms[1].Name);
        Assert.Equal("Room B", rooms[2].Name);
    }

    [Fact]
    public async Task Shall_delete_room_and_reassign_devices()
    {
        // Arrange
        var building = CreateTestBuilding();
        var floor = new Floor { Id = Guid.NewGuid(), Name = "Level 1", Elevation = 0, SortOrder = 0, BuildingId = building.Id };
        _dbContext.Floors.Add(floor);
        var room = new Room { Id = Guid.NewGuid(), Name = "Doomed Room", Number = "1X99", SortOrder = 0, FloorId = floor.Id };
        _dbContext.Rooms.Add(room);
        var device = ApiTestData.CreateDevice("sensor-in-room", "Room sensor", "CO2", "");
        device.RoomId = room.Id;
        device.BuildingId = building.Id;
        _dbContext.Devices.Add(device);
        await _dbContext.SaveChangesAsync();

        // Act
        device.RoomId = null;
        _dbContext.Rooms.Remove(room);
        await _dbContext.SaveChangesAsync();

        // Assert
        var loaded = await _dbContext.Devices.SingleAsync(d => d.UniqueId == "sensor-in-room");
        Assert.Null(loaded.RoomId);
        Assert.Equal(building.Id, loaded.BuildingId);
        Assert.Empty(await _dbContext.Rooms.Where(r => r.FloorId == floor.Id).ToListAsync());
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }
}
