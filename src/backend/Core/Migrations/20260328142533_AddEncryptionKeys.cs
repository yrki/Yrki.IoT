using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Core.Migrations
{
    /// <inheritdoc />
    public partial class AddEncryptionKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EncryptionKeys",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DeviceUniqueId = table.Column<string>(type: "text", nullable: true),
                    GroupName = table.Column<string>(type: "text", nullable: true),
                    EncryptedKeyValue = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EncryptionKeys", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EncryptionKeys_DeviceUniqueId",
                table: "EncryptionKeys",
                column: "DeviceUniqueId");

            migrationBuilder.CreateIndex(
                name: "IX_EncryptionKeys_GroupName",
                table: "EncryptionKeys",
                column: "GroupName");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EncryptionKeys");
        }
    }
}
