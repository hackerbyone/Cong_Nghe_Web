using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BaseCore.Entities;
using BaseCore.Repository;
using BaseCore.Repository.EFCore;

namespace BaseCore.APIService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductsController : ControllerBase
    {
        private readonly IProductRepositoryEF _productRepository;
        private readonly ICategoryRepositoryEF _categoryRepository;
        private readonly MySqlDbContext _context;

        public ProductsController(
            IProductRepositoryEF productRepository,
            ICategoryRepositoryEF categoryRepository,
            MySqlDbContext context)
        {
            _productRepository  = productRepository;
            _categoryRepository = categoryRepository;
            _context            = context;
        }

        // Helper: tính rating + số lượng đánh giá cho nhiều sản phẩm cùng lúc
        private async Task<Dictionary<int, (double Avg, int Count)>> GetRatingsAsync(IEnumerable<int> productIds)
        {
            var ids = productIds.ToList();
            if (ids.Count == 0) return new();

            return await _context.Reviews
                .Where(r => ids.Contains(r.ProductId))
                .GroupBy(r => r.ProductId)
                .Select(g => new
                {
                    ProductId = g.Key,
                    Avg   = Math.Round(g.Average(r => (double)r.Rating), 1),
                    Count = g.Count()
                })
                .ToDictionaryAsync(x => x.ProductId, x => (x.Avg, x.Count));
        }

        private static object ToDto(Product p, double rating, int reviews) => new
        {
            p.Id, p.Name, p.Price, p.PairPrice, p.Stock,
            p.ImageUrl, p.Description, p.CareInstructions, p.Environment,
            p.MaleStock, p.FemaleStock, p.CategoryId,
            rating, reviews
        };



        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? keyword,
            [FromQuery] int? categoryId,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice,
            [FromQuery] string? sortBy,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            var (products, totalCount) = await _productRepository.SearchAsync(
                keyword, categoryId, minPrice, maxPrice, sortBy, page, pageSize);

            var ratings = await GetRatingsAsync(products.Select(p => p.Id));

            var items = products.Select(p =>
            {
                var (avg, cnt) = ratings.GetValueOrDefault(p.Id, (0.0, 0));
                return ToDto(p, avg, cnt);
            }).ToList();

            return Ok(new
            {
                items,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var product = await _productRepository.GetByIdAsync(id);
            if (product == null)
                return NotFound(new { message = "Product not found" });

            var ratings = await GetRatingsAsync([product.Id]);
            var (avg, cnt) = ratings.GetValueOrDefault(product.Id, (0.0, 0));

            return Ok(ToDto(product, avg, cnt));
        }

        /// <summary>
        /// Create new product (requires authentication)
        /// </summary>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] ProductCreateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Tên sản phẩm không được để trống" });

            if (dto.Price < 0)
                return BadRequest(new { message = "Giá sản phẩm không được âm" });

            if (dto.MaleStock < 0 || dto.FemaleStock < 0)
                return BadRequest(new { message = "Số lượng giới tính không được âm" });

            var category = await _categoryRepository.GetByIdAsync(dto.CategoryId);
            if (category == null)
                return BadRequest(new { message = "Danh mục không tồn tại" });

            int maleStock = dto.MaleStock;
            int femaleStock = dto.FemaleStock;
            int genderTotal = maleStock + femaleStock;
            bool isGenderProduct = maleStock > 0 || femaleStock > 0;

            if (isGenderProduct)
            {
                // Nếu admin nhập stock > 0 thì phải bằng đúng tổng gender
                if (dto.Stock > 0 && dto.Stock != genderTotal)
                    return BadRequest(new
                    {
                        message = $"Tổng số lượng kho ({dto.Stock}) phải bằng đực ({maleStock}) + cái ({femaleStock}) = {genderTotal}. " +
                                  (dto.Stock > genderTotal
                                      ? $"Đang dư {dto.Stock - genderTotal} con chưa được phân giới tính."
                                      : $"Đang thiếu {genderTotal - dto.Stock} con so với tổng kho.")
                    });
            }
            else if (dto.Stock < 0)
            {
                return BadRequest(new { message = "Số lượng kho không được âm" });
            }

            // Khi dùng gender: tổng kho = maleStock + femaleStock (auto-sync)
            int finalStock = isGenderProduct ? genderTotal : dto.Stock;

            var product = new Product
            {
                Name = dto.Name,
                Price = dto.Price,
                PairPrice = dto.PairPrice,
                Stock = finalStock,
                CategoryId = dto.CategoryId,
                Description = dto.Description,
                CareInstructions = dto.CareInstructions,
                Environment = dto.Environment,
                MaleStock = maleStock,
                FemaleStock = femaleStock,
                ImageUrl = dto.ImageUrl ?? ""
            };

            await _productRepository.AddAsync(product);

            if (product.CategoryId == 1 || product.CategoryId == 2)
                await UpsertTank(product);
            else if (product.CategoryId == 3 || product.CategoryId == 4 || product.CategoryId == 5)
                await UpsertAccessoryEntry(product);

            return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
        }

        /// <summary>
        /// Update product (requires authentication)
        /// </summary>
        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> Update(int id, [FromBody] ProductUpdateDto dto)
        {
            var product = await _productRepository.GetByIdAsync(id);
            if (product == null)
                return NotFound(new { message = "Sản phẩm không tồn tại" });

            if (dto.Price.HasValue && dto.Price < 0)
                return BadRequest(new { message = "Giá sản phẩm không được âm" });

            if ((dto.MaleStock.HasValue && dto.MaleStock < 0) || (dto.FemaleStock.HasValue && dto.FemaleStock < 0))
                return BadRequest(new { message = "Số lượng giới tính không được âm" });

            int newMaleStock = dto.MaleStock ?? product.MaleStock;
            int newFemaleStock = dto.FemaleStock ?? product.FemaleStock;
            int newGenderTotal = newMaleStock + newFemaleStock;
            bool isGenderProduct = newMaleStock > 0 || newFemaleStock > 0;
            int targetStock = dto.Stock ?? product.Stock;

            if (isGenderProduct && targetStock > 0 && targetStock != newGenderTotal)
                return BadRequest(new
                {
                    message = $"Tổng số lượng kho ({targetStock}) phải bằng đực ({newMaleStock}) + cái ({newFemaleStock}) = {newGenderTotal}. " +
                              (targetStock > newGenderTotal
                                  ? $"Đang dư {targetStock - newGenderTotal} con chưa được phân giới tính."
                                  : $"Đang thiếu {newGenderTotal - targetStock} con so với tổng kho.")
                });

            product.Name = dto.Name ?? product.Name;
            product.Price = dto.Price ?? product.Price;
            product.PairPrice = dto.PairPrice ?? product.PairPrice;
            product.CategoryId = dto.CategoryId ?? product.CategoryId;
            product.Description = dto.Description ?? product.Description;
            product.CareInstructions = dto.CareInstructions ?? product.CareInstructions;
            product.Environment = dto.Environment ?? product.Environment;
            product.MaleStock = newMaleStock;
            product.FemaleStock = newFemaleStock;
            product.ImageUrl = dto.ImageUrl ?? product.ImageUrl;
            // Auto-sync stock
            product.Stock = isGenderProduct ? newMaleStock + newFemaleStock : targetStock;

            await _productRepository.UpdateAsync(product);

            if (product.CategoryId == 1 || product.CategoryId == 2)
                await UpsertTank(product);
            else if (product.CategoryId == 3 || product.CategoryId == 4 || product.CategoryId == 5)
                await UpsertAccessoryEntry(product);

            return Ok(product);
        }

        /// <summary>
        /// Delete product (requires authentication)
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> Delete(int id)
        {
            var product = await _productRepository.GetByIdAsync(id);
            if (product == null)
                return NotFound(new { message = "Product not found" });

            await _productRepository.DeleteAsync(product);
            return Ok(new { message = "Product deleted successfully" });
        }

        [HttpGet("category/{categoryId}")]
        public async Task<IActionResult> GetByCategory(int categoryId)
        {
            var products = await _productRepository.GetByCategoryAsync(categoryId);
            var ratings  = await GetRatingsAsync(products.Select(p => p.Id));
            var result   = products.Select(p =>
            {
                var (avg, cnt) = ratings.GetValueOrDefault(p.Id, (0.0, 0));
                return ToDto(p, avg, cnt);
            }).ToList();
            return Ok(result);
        }

        // Tạo hoặc cập nhật phụ kiện/thiết bị tương ứng với sản phẩm (category 3, 4)
        private async Task UpsertAccessoryEntry(Product product)
        {
            var name = product.Name ?? $"Sản phẩm #{product.Id}";
            var type = product.CategoryId == 3 ? "Equipment" : "Accessory";
            var acc  = await _context.Accessories
                .FirstOrDefaultAsync(a => a.ProductId == product.Id && a.IsActive);

            if (acc == null)
            {
                _context.Accessories.Add(new BaseCore.Entities.Accessory
                {
                    ProductId     = product.Id,
                    Name          = name,
                    Type          = type,
                    Quantity      = product.Stock,
                    Status        = "Good",
                    IsActive      = true,
                    Created       = DateTime.Now,
                    CreatedBy     = "system",
                    CreatedByName = "Hệ thống (auto)"
                });
            }
            else
            {
                acc.Name     = name;
                acc.Quantity = product.Stock;
                acc.Modified = DateTime.Now;
            }
            await _context.SaveChangesAsync();
        }

        // Tạo hoặc cập nhật bể kho tương ứng với sản phẩm cá
        private async Task UpsertTank(Product product)
        {
            int male, female;
            string? notes = null;

            if (product.MaleStock > 0 || product.FemaleStock > 0)
            {
                male   = product.MaleStock;
                female = product.FemaleStock;
            }
            else
            {
                // Chưa phân loại giới tính → đặt hết vào MaleCount để TotalCount = Stock
                male   = product.Stock;
                female = 0;
                notes  = "Chưa phân loại giới tính";
            }

            var tankName = product.Name ?? $"Loài #{product.Id}";
            var tank = await _context.TankFishTrackings
                .FirstOrDefaultAsync(t => t.ProductId == product.Id);

            if (tank == null)
            {
                _context.TankFishTrackings.Add(new TankFishTracking
                {
                    TankName          = tankName,
                    ProductId         = product.Id,
                    MaleCount         = male,
                    FemaleCount       = female,
                    Notes             = notes,
                    LastUpdated       = DateTime.Now,
                    LastUpdatedBy     = "system",
                    LastUpdatedByName = "Hệ thống (auto)"
                });
            }
            else
            {
                tank.TankName          = tankName;
                tank.MaleCount         = male;
                tank.FemaleCount       = female;
                if (notes != null) tank.Notes = notes;
                tank.LastUpdated       = DateTime.Now;
                tank.LastUpdatedBy     = "system";
                tank.LastUpdatedByName = "Hệ thống (auto)";
            }

            await _context.SaveChangesAsync();
        }
    }

    // DTOs
    public class ProductCreateDto
    {
        public string Name { get; set; } = "";
        public decimal Price { get; set; }
        public decimal? PairPrice { get; set; }
        public int Stock { get; set; }
        public int CategoryId { get; set; }
        public string? Description { get; set; }
        public string? CareInstructions { get; set; }
        public string? Environment { get; set; }
        public int MaleStock { get; set; }
        public int FemaleStock { get; set; }
        public string? ImageUrl { get; set; }
    }

    public class ProductUpdateDto
    {
        public string? Name { get; set; }
        public decimal? Price { get; set; }
        public decimal? PairPrice { get; set; }
        public int? Stock { get; set; }
        public int? CategoryId { get; set; }
        public string? Description { get; set; }
        public string? CareInstructions { get; set; }
        public string? Environment { get; set; }
        public int? MaleStock { get; set; }
        public int? FemaleStock { get; set; }
        public string? ImageUrl { get; set; }
    }
}
