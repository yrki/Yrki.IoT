using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Api.Database.Entities
{
    public class Location
    {
        [Key]
        public Guid Id { get; set; }

        public Guid? ParentId { get; set; }

        public string? Name { get; set; }

        [Column(TypeName = "jsonb")]
        public Coordinates? Coordinates { get; set; }

        [Column(TypeName = "jsonb")]
        public Dictionary<string, object>? Properties { get; set; }

        public string? Type { get; set; }

        public DateTimeOffset? UpdatedAt { get; set; }            

        public DateTimeOffset? CreatedAt { get; set; }

        public virtual Owner? Owner { get; set; }
    }
}