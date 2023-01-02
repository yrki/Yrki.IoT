using System.ComponentModel.DataAnnotations;

namespace Api.Database.Entities
{
    public class Owner
    {
        [Key]
        public Guid Id { get; set; }

    }
}