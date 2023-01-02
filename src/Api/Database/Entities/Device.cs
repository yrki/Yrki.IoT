using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Api.Database.Entities
{
    public class Device
    {
        [Key]
        public Guid Id { get; set; }

        public required string UniqueId { get; set; }

        public virtual Location? Location { get; set; }
        
        public string[]? Tags { get; set; }

        [Column(TypeName = "jsonb")]
        public Dictionary<string, object>? Properties { get; set; }
        
        public string? Type { get; set; }

        public DateTimeOffset? UpdatedAt { get; set; }

        public DateTimeOffset? CreatedAt { get; set; }

        public virtual Owner? Owner { get; set; }

    }
}