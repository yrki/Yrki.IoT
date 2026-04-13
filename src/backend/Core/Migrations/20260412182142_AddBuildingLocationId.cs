using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Core.Migrations
{
    /// <inheritdoc />
    public partial class AddBuildingLocationId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LocationId",
                table: "Buildings",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Buildings_LocationId",
                table: "Buildings",
                column: "LocationId");

            migrationBuilder.AddForeignKey(
                name: "FK_Buildings_Locations_LocationId",
                table: "Buildings",
                column: "LocationId",
                principalTable: "Locations",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Buildings_Locations_LocationId",
                table: "Buildings");

            migrationBuilder.DropIndex(
                name: "IX_Buildings_LocationId",
                table: "Buildings");

            migrationBuilder.DropColumn(
                name: "LocationId",
                table: "Buildings");
        }
    }
}
