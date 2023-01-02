using System.ComponentModel.DataAnnotations;

namespace Api.Database.Entities
{
    public class User
    {
        [Key]
        public Guid Id { get; set; }
        
        public string? Name { get; set; }
        
        public string? Email { get; set; }
        
        public string? Phone { get; set; }
        
        public DateTimeOffset? LastLogin { get; set; }

        public DateTimeOffset? UpdatedAt { get; set; }

        public DateTimeOffset? CreatedAt { get; set; }

        public virtual Owner? Owner { get; set; }
    }
}