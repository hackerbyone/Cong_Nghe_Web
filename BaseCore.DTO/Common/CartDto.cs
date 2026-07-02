using System.Collections.Generic;

namespace BaseCore.DTO.Common
{
    public class CartDto
    {
        public int CartId { get; set; }
        public string UserId { get; set; } = "";     // ✅ int → string
        public List<CartItemDto> Items { get; set; } = new();
        public decimal TotalAmount { get; set; }
        public int TotalItems { get; set; }
    }

    public class CartItemDto
    {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public string ProductName { get; set; } = "";
        public decimal Price { get; set; }
        public int Quantity { get; set; }
        public int AvailableStock { get; set; }
        public decimal SubTotal => Price * Quantity;
        public string ImageUrl { get; set; } = "";
        public string? SelectedGender { get; set; }
        public decimal? PhMin { get; set; }
        public decimal? PhMax { get; set; }
        public decimal? TempMin { get; set; }
        public decimal? TempMax { get; set; }
        public string? Compatibility { get; set; }
    }

    public class AddToCartDto
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; } = 1;
        public string? SelectedGender { get; set; }
    }

    public class UpdateCartItemDto
    {
        public int Quantity { get; set; }
    }

    public class CheckoutDto
    {
        public string ShippingAddress { get; set; } = "";
        public string ShippingMethod { get; set; } = "Standard";
        public string PaymentMethod { get; set; } = "COD";
        public string CustomerName { get; set; } = "";
        public string CustomerPhone { get; set; } = "";
        public decimal ShippingFee { get; set; } = 0;
        public decimal PackagingFee { get; set; } = 0;
    }
}
