using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Core.Migrations
{
    public partial class AddManufacturerToEncryptionKeys : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Manufacturer",
                table: "EncryptionKeys",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_EncryptionKeys_Manufacturer",
                table: "EncryptionKeys",
                column: "Manufacturer");

            migrationBuilder.CreateIndex(
                name: "IX_EncryptionKeys_Manufacturer_DeviceUniqueId",
                table: "EncryptionKeys",
                columns: new[] { "Manufacturer", "DeviceUniqueId" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_EncryptionKeys_Manufacturer",
                table: "EncryptionKeys");

            migrationBuilder.DropIndex(
                name: "IX_EncryptionKeys_Manufacturer_DeviceUniqueId",
                table: "EncryptionKeys");

            migrationBuilder.DropColumn(
                name: "Manufacturer",
                table: "EncryptionKeys");
        }
    }
}
