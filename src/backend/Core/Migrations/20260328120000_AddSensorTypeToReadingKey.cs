using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Core.Migrations;

/// <inheritdoc />
public partial class AddSensorTypeToReadingKey : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropPrimaryKey(name: "PK_sensor_readings", table: "sensor_readings");

        migrationBuilder.AddPrimaryKey(
            name: "PK_sensor_readings",
            table: "sensor_readings",
            columns: new[] { "timestamp", "sensor_id", "sensor_type" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropPrimaryKey(name: "PK_sensor_readings", table: "sensor_readings");

        migrationBuilder.AddPrimaryKey(
            name: "PK_sensor_readings",
            table: "sensor_readings",
            columns: new[] { "timestamp", "sensor_id" });
    }
}
