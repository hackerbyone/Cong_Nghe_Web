using System;
using System.Linq;
using System.Threading.Tasks;
using BaseCore.Entities;
using BaseCore.Repository;
using BaseCore.DTO.Common;
using BaseCore.Repository.EFCore;

namespace BaseCore.Services
{
    public class CartService : ICartService
    {
        private readonly ICartRepository _cartRepo;
        private readonly IRepository<Product> _productRepo;
        private readonly MySqlDbContext _context;

        public CartService(ICartRepository cartRepo, IRepository<Product> productRepo, MySqlDbContext context)
        {
            _cartRepo = cartRepo;
            _productRepo = productRepo;
            _context = context;
        }

        private async Task<Cart> GetOrCreateCart(string userId)
        {
            var cart = await _cartRepo.GetCartByUserId(userId);
            if (cart is null)
            {
                cart = new Cart { UserId = userId };
                await _cartRepo.AddAsync(cart);
                await _context.SaveChangesAsync();
            }
            return cart;
        }

        // 1 cặp = 2 con (đực + cái) → giá nhân đôi
        private static decimal GetEffectivePrice(Product? product, string? selectedGender)
        {
            if (product is null) return 0;
            
            if (selectedGender == "Cặp")
            {
                // Nếu có pairPrice, dùng nó; nếu không thì dùng price
                return product.PairPrice ?? product.Price;
            }
            return product.Price;
        }

        private static CartDto MapToDto(Cart? cart)
        {
            if (cart is null) return new CartDto();
            return new CartDto
            {
                CartId = cart.Id,
                UserId = cart.UserId,
                Items = cart.Items.Select(i => new CartItemDto
                {
                    Id = i.Id,
                    ProductId = i.ProductId,
                    ProductName = i.Product?.Name ?? string.Empty,
                    Price = GetEffectivePrice(i.Product, i.SelectedGender),
                    Quantity = i.Quantity,
                    AvailableStock = i.Product is null ? 0 : GetAvailableStock(i.Product, i.SelectedGender),
                    ImageUrl = i.Product?.ImageUrl ?? string.Empty,
                    SelectedGender = i.SelectedGender,
                    PhMin = i.Product?.PhMin,
                    PhMax = i.Product?.PhMax,
                    TempMin = i.Product?.TempMin,
                    TempMax = i.Product?.TempMax,
                    Compatibility = i.Product?.Compatibility
                }).ToList(),
                TotalAmount = cart.Items.Sum(i =>
                    GetEffectivePrice(i.Product, i.SelectedGender) * i.Quantity),
                TotalItems = cart.Items.Sum(i => i.Quantity)
            };
        }

        private static int GetAvailableStock(Product product, string? gender)
        {
            bool isGenderProduct = product.MaleStock > 0 || product.FemaleStock > 0;
            if (!isGenderProduct) return product.Stock;

            return gender switch
            {
                "Đực" => product.MaleStock,
                "Cái" => product.FemaleStock,
                // Cặp: cần cả đực lẫn cái, tối đa là min của hai bên
                "Cặp" => Math.Min(product.MaleStock, product.FemaleStock),
                _ => product.MaleStock + product.FemaleStock
            };
        }

        private static void ValidateGenderSelection(Product product, string? selectedGender, int quantity)
        {
            bool isGenderProduct = product.MaleStock > 0 || product.FemaleStock > 0;
            if (!isGenderProduct) return;

            if (string.IsNullOrEmpty(selectedGender))
                throw new Exception("Vui lòng chọn giới tính cho sản phẩm này");

            int available = GetAvailableStock(product, selectedGender);
            if (available < quantity)
                throw new Exception(
                    selectedGender == "Cặp"
                        ? $"Chỉ còn {available} cặp trong kho"
                        : $"Chỉ còn {available} con {selectedGender} trong kho"
                );
        }

        public async Task<CartDto> GetCart(string userId)
        {
            var cart = await _cartRepo.GetCartByUserId(userId);
            return MapToDto(cart);
        }

        public async Task<CartDto> AddItem(string userId, int productId, int quantity, string? selectedGender)
        {
            if (quantity <= 0) throw new ArgumentException("Số lượng phải > 0");

            var product = await _productRepo.GetByIdAsync(productId);
            if (product is null) throw new Exception("Sản phẩm không tồn tại");

            ValidateGenderSelection(product, selectedGender, quantity);

            bool isGenderProduct = product.MaleStock > 0 || product.FemaleStock > 0;
            if (!isGenderProduct && product.Stock < quantity)
                throw new Exception("Số lượng vượt quá tồn kho");

            var cart = await GetOrCreateCart(userId);

            // Tìm item trùng cả productId lẫn gender
            var existingItem = cart.Items.FirstOrDefault(i =>
                i.ProductId == productId && i.SelectedGender == selectedGender);

            if (existingItem is not null)
            {
                int newQty = existingItem.Quantity + quantity;
                ValidateGenderSelection(product, selectedGender, newQty);
                if (!isGenderProduct && product.Stock < newQty)
                    throw new Exception("Số lượng vượt quá tồn kho");
                existingItem.Quantity = newQty;
            }
            else
            {
                cart.Items.Add(new CartItem
                {
                    ProductId = productId,
                    Quantity = quantity,
                    CartId = cart.Id,
                    SelectedGender = selectedGender
                });
            }

            cart.LastUpdated = DateTime.UtcNow;
            await _cartRepo.UpdateAsync(cart);
            await _context.SaveChangesAsync();
            return await GetCart(userId);
        }

        public async Task<CartDto> UpdateQuantity(string userId, int cartItemId, int quantity)
        {
            if (quantity < 0) throw new ArgumentException("Số lượng không hợp lệ");
            var cart = await GetOrCreateCart(userId);
            var item = cart.Items.FirstOrDefault(i => i.Id == cartItemId);
            if (item is null) throw new Exception("Sản phẩm không có trong giỏ");

            if (quantity == 0) return await RemoveItem(userId, cartItemId);

            var product = await _productRepo.GetByIdAsync(item.ProductId);
            if (product is null) throw new Exception("Sản phẩm không tồn tại");

            ValidateGenderSelection(product, item.SelectedGender, quantity);

            bool isGenderProduct = product.MaleStock > 0 || product.FemaleStock > 0;
            if (!isGenderProduct && product.Stock < quantity)
                throw new Exception("Số lượng vượt quá tồn kho");

            item.Quantity = quantity;
            cart.LastUpdated = DateTime.UtcNow;
            await _cartRepo.UpdateAsync(cart);
            await _context.SaveChangesAsync();
            return await GetCart(userId);
        }

        public async Task<CartDto> RemoveItem(string userId, int cartItemId)
        {
            var cart = await GetOrCreateCart(userId);
            var item = cart.Items.FirstOrDefault(i => i.Id == cartItemId);
            if (item is not null)
            {
                cart.Items.Remove(item);
                await _cartRepo.UpdateAsync(cart);
                await _context.SaveChangesAsync();
            }
            return await GetCart(userId);
        }

        public async Task<bool> ClearCart(string userId)
        {
            var cart = await _cartRepo.GetCartByUserId(userId);
            if (cart is not null)
                await _cartRepo.ClearCart(cart.Id);
            return true;
        }
    }
}
