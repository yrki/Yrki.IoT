using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Core.Migrations;

public partial class AddIsDeletedToDevices : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'Devices'
                      AND column_name = 'IsDeleted'
                ) THEN
                    ALTER TABLE "Devices" ADD "IsDeleted" boolean NOT NULL DEFAULT FALSE;
                END IF;
            END
            $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'Devices'
                      AND column_name = 'IsDeleted'
                ) THEN
                    ALTER TABLE "Devices" DROP COLUMN "IsDeleted";
                END IF;
            END
            $$;
            """);
    }
}
