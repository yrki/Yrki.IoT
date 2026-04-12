using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Core.Migrations
{
    /// <inheritdoc />
    public partial class AddBuildings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "BimX",
                table: "Devices",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "BimY",
                table: "Devices",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "BimZ",
                table: "Devices",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BuildingId",
                table: "Devices",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Buildings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Address = table.Column<string>(type: "text", nullable: true),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    IfcFileName = table.Column<string>(type: "text", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Buildings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Devices_BuildingId",
                table: "Devices",
                column: "BuildingId");

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Buildings_BuildingId",
                table: "Devices",
                column: "BuildingId",
                principalTable: "Buildings",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Buildings_BuildingId",
                table: "Devices");

            migrationBuilder.DropTable(
                name: "Buildings");

            migrationBuilder.DropIndex(
                name: "IX_Devices_BuildingId",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "BimX",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "BimY",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "BimZ",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "BuildingId",
                table: "Devices");
        }
    }
}
