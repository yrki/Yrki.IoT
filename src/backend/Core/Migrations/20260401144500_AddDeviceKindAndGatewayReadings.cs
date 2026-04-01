using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Core.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceKindAndGatewayReadings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "Devices",
                type: "text",
                nullable: false,
                defaultValue: "Sensor");

            migrationBuilder.CreateTable(
                name: "gateway_readings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    gateway_unique_id = table.Column<string>(type: "text", nullable: false),
                    sensor_unique_id = table.Column<string>(type: "text", nullable: false),
                    rssi = table.Column<int>(type: "integer", nullable: true),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gateway_readings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gateway_readings_gateway_unique_id",
                table: "gateway_readings",
                column: "gateway_unique_id");

            migrationBuilder.CreateIndex(
                name: "IX_gateway_readings_received_at",
                table: "gateway_readings",
                column: "received_at");

            migrationBuilder.CreateIndex(
                name: "IX_gateway_readings_sensor_unique_id",
                table: "gateway_readings",
                column: "sensor_unique_id");

            migrationBuilder.Sql("""
                insert into "Devices" (
                    "Id",
                    "UniqueId",
                    "Name",
                    "Type",
                    "Description",
                    "Manufacturer",
                    "Kind",
                    "IsNew",
                    "IsDeleted",
                    "LocationId",
                    "LastContact",
                    "InstallationDate"
                )
                select
                    (
                        substr(md5(raw.gateway_id), 1, 8) || '-' ||
                        substr(md5(raw.gateway_id), 9, 4) || '-' ||
                        substr(md5(raw.gateway_id), 13, 4) || '-' ||
                        substr(md5(raw.gateway_id), 17, 4) || '-' ||
                        substr(md5(raw.gateway_id), 21, 12)
                    )::uuid,
                    raw.gateway_id,
                    raw.gateway_id,
                    'Gateway',
                    '',
                    null,
                    'Gateway',
                    false,
                    false,
                    null,
                    max(raw.received_at),
                    min(raw.received_at)
                from raw_payloads raw
                where raw.gateway_id is not null
                  and not exists (
                      select 1
                      from "Devices" existing
                      where existing."UniqueId" = raw.gateway_id
                  )
                group by raw.gateway_id;
                """);

            migrationBuilder.Sql("""
                insert into gateway_readings (
                    "Id",
                    gateway_unique_id,
                    sensor_unique_id,
                    rssi,
                    received_at
                )
                select
                    raw."Id",
                    raw.gateway_id,
                    raw.device_id,
                    raw.rssi,
                    raw.received_at
                from raw_payloads raw
                where raw.gateway_id is not null
                  and raw.device_id is not null;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gateway_readings");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Devices");
        }
    }
}
