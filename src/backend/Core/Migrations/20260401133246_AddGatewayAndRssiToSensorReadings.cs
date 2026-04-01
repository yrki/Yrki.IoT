using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Core.Migrations
{
    /// <inheritdoc />
    public partial class AddGatewayAndRssiToSensorReadings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "gateway_id",
                table: "sensor_readings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "rssi",
                table: "sensor_readings",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_sensor_readings_gateway_id",
                table: "sensor_readings",
                column: "gateway_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_sensor_readings_gateway_id",
                table: "sensor_readings");

            migrationBuilder.DropColumn(
                name: "gateway_id",
                table: "sensor_readings");

            migrationBuilder.DropColumn(
                name: "rssi",
                table: "sensor_readings");
        }
    }
}
