using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BaseCore.Entities;
using BaseCore.Repository;
using System.Text.Json;

namespace BaseCore.APIService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WarehouseController : ControllerBase
    {
        private readonly MySqlDbContext _context;

        public WarehouseController(MySqlDbContext context)
        {
            _context = context;
        }

        // ────────────────────────────────────────────────────────────
        //  BỂ CÁ (Tank Fish Tracking)
        // ────────────────────────────────────────────────────────────

        [HttpGet("tanks")]
        public async Task<IActionResult> GetTanks([FromQuery] string? keyword, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var query = _context.TankFishTrackings
                .Include(t => t.Product)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(keyword))
                query = query.Where(t => t.TankName.Contains(keyword) ||
                                         (t.Product != null && t.Product.Name.Contains(keyword)));

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(t => t.LastUpdated)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new
                {
                    t.Id, t.TankName, t.ProductId,
                    ProductName = t.Product != null ? t.Product.Name : "",
                    ProductImage = t.Product != null ? t.Product.ImageUrl : "",
                    t.MaleCount, t.FemaleCount,
                    TotalCount = t.MaleCount + t.FemaleCount,
                    t.Notes, t.LastUpdated, t.LastUpdatedBy, t.LastUpdatedByName
                })
                .ToListAsync();

            return Ok(new { items, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
        }

        [HttpGet("tanks/{id}")]
        public async Task<IActionResult> GetTank(int id)
        {
            var tank = await _context.TankFishTrackings
                .Include(t => t.Product)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (tank == null) return NotFound(new { message = "Không tìm thấy bể cá" });

            return Ok(new
            {
                tank.Id, tank.TankName, tank.ProductId,
                ProductName = tank.Product?.Name ?? "",
                ProductImage = tank.Product?.ImageUrl ?? "",
                tank.MaleCount, tank.FemaleCount,
                TotalCount = tank.MaleCount + tank.FemaleCount,
                tank.Notes, tank.LastUpdated, tank.LastUpdatedBy, tank.LastUpdatedByName
            });
        }

        [HttpPost("tanks")]
        public async Task<IActionResult> CreateTank([FromBody] TankRequest req)
        {
            var product = await _context.Products.FindAsync(req.ProductId);
            if (product == null)
                return BadRequest(new { message = "Sản phẩm không tồn tại" });

            var tankName = product.Name ?? $"Loài #{product.Id}";

            var existing = await _context.TankFishTrackings
                .FirstOrDefaultAsync(t => t.ProductId == req.ProductId);

            if (existing != null)
            {
                var oldValue = JsonSerializer.Serialize(new { maleCount = existing.MaleCount, femaleCount = existing.FemaleCount });
                existing.TankName          = tankName;
                existing.MaleCount         += req.MaleCount;
                existing.FemaleCount       += req.FemaleCount;
                if (!string.IsNullOrWhiteSpace(req.Notes)) existing.Notes = req.Notes;
                existing.LastUpdated       = DateTime.Now;
                existing.LastUpdatedBy     = req.StaffId;
                existing.LastUpdatedByName = req.StaffName;
                await _context.SaveChangesAsync();

                await AddCommit(req.StaffId, req.StaffName,
                    req.CommitMessage ?? $"Nhập thêm vào bể {tankName}: +{req.MaleCount} đực, +{req.FemaleCount} cái",
                    "Fish", existing.Id, tankName,
                    oldValue,
                    JsonSerializer.Serialize(new { maleCount = existing.MaleCount, femaleCount = existing.FemaleCount }));

                return Ok(new { existing.Id, message = $"Đã cộng thêm {req.MaleCount} đực + {req.FemaleCount} cái vào bể {tankName}.", updated = true });
            }

            var tank = new TankFishTracking
            {
                TankName          = tankName,
                ProductId         = product.Id,
                MaleCount         = req.MaleCount,
                FemaleCount       = req.FemaleCount,
                Notes             = req.Notes,
                LastUpdated       = DateTime.Now,
                LastUpdatedBy     = req.StaffId,
                LastUpdatedByName = req.StaffName
            };
            _context.TankFishTrackings.Add(tank);
            await _context.SaveChangesAsync();

            await AddCommit(req.StaffId, req.StaffName,
                req.CommitMessage ?? $"Tạo bể mới: {tankName}",
                "Fish", tank.Id, tankName,
                null,
                JsonSerializer.Serialize(new { maleCount = req.MaleCount, femaleCount = req.FemaleCount }));

            return Ok(new { tank.Id, message = "Tạo bể thành công.", updated = false });
        }

        [HttpPut("tanks/{id}")]
        public async Task<IActionResult> UpdateTank(int id, [FromBody] TankRequest req)
        {
            var tank = await _context.TankFishTrackings.FindAsync(id);
            if (tank == null) return NotFound(new { message = "Không tìm thấy bể cá" });

            var oldValue = JsonSerializer.Serialize(new { maleCount = tank.MaleCount, femaleCount = tank.FemaleCount, notes = tank.Notes });

            if (req.ProductId > 0 && req.ProductId != tank.ProductId)
            {
                var product = await _context.Products.FindAsync(req.ProductId);
                if (product == null) return BadRequest(new { message = "Sản phẩm không tồn tại" });
                tank.ProductId = req.ProductId;
                tank.TankName  = product.Name ?? $"Loài #{req.ProductId}";
            }

            tank.MaleCount         = req.MaleCount;
            tank.FemaleCount       = req.FemaleCount;
            tank.Notes             = req.Notes;
            tank.LastUpdated       = DateTime.Now;
            tank.LastUpdatedBy     = req.StaffId;
            tank.LastUpdatedByName = req.StaffName;

            await _context.SaveChangesAsync();

            await AddCommit(req.StaffId, req.StaffName,
                req.CommitMessage ?? $"Cập nhật bể: {tank.TankName}",
                "Fish", tank.Id, tank.TankName,
                oldValue,
                JsonSerializer.Serialize(new { maleCount = req.MaleCount, femaleCount = req.FemaleCount, notes = req.Notes }));

            return Ok(new { message = "Cập nhật thành công" });
        }

        [HttpDelete("tanks/{id}")]
        public async Task<IActionResult> DeleteTank(int id, [FromQuery] string staffId = "", [FromQuery] string staffName = "")
        {
            var tank = await _context.TankFishTrackings.FindAsync(id);
            if (tank == null) return NotFound(new { message = "Không tìm thấy bể cá" });

            await AddCommit(staffId, staffName,
                $"Xoá bể: {tank.TankName}",
                "Fish", tank.Id, tank.TankName,
                JsonSerializer.Serialize(new { maleCount = tank.MaleCount, femaleCount = tank.FemaleCount }),
                null);

            _context.TankFishTrackings.Remove(tank);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Xoá bể thành công" });
        }

        // ────────────────────────────────────────────────────────────
        //  PHỤ KIỆN & THIẾT BỊ (Accessories)
        // ────────────────────────────────────────────────────────────

        [HttpGet("accessories")]
        public async Task<IActionResult> GetAccessories(
            [FromQuery] string? keyword,
            [FromQuery] string? type,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var query = _context.Accessories.Where(a => a.IsActive).AsQueryable();

            if (!string.IsNullOrWhiteSpace(keyword))
                query = query.Where(a => a.Name.Contains(keyword));
            if (!string.IsNullOrWhiteSpace(type))
                query = query.Where(a => a.Type == type);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(a => a.Modified ?? a.Created)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { items, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
        }

        [HttpPost("accessories")]
        public async Task<IActionResult> CreateAccessory([FromBody] AccessoryRequest req)
        {
            if (req.ProductId.HasValue)
            {
                var product = await _context.Products.FindAsync(req.ProductId.Value);
                if (product == null) return BadRequest(new { message = "Sản phẩm không tồn tại" });

                var existing = await _context.Accessories
                    .FirstOrDefaultAsync(a => a.ProductId == req.ProductId && a.IsActive);

                var accName = product.Name ?? $"Sản phẩm #{product.Id}";
                var accType = product.CategoryId == 3 ? "Equipment" : "Accessory";

                if (existing != null)
                {
                    var oldValue = JsonSerializer.Serialize(new { quantity = existing.Quantity, status = existing.Status });
                    existing.Name     = accName;
                    existing.Quantity += req.Quantity;
                    // Khi nhập thêm hàng tốt, không thay đổi trạng thái hiện tại
                    if (!string.IsNullOrWhiteSpace(req.Description)) existing.Description = req.Description;
                    existing.Modified = DateTime.Now;
                    await _context.SaveChangesAsync();

                    await AddCommit(req.StaffId, req.StaffName,
                        req.CommitMessage ?? $"Nhập thêm {(accType == "Equipment" ? "thiết bị" : "phụ kiện")} {accName}: +{req.Quantity}",
                        "Accessory", existing.Id, accName,
                        oldValue,
                        JsonSerializer.Serialize(new { quantity = existing.Quantity, status = existing.Status }));

                    return Ok(new { existing.Id, message = $"Đã cộng thêm {req.Quantity} vào {accName}.", updated = true });
                }

                var newAcc = new Accessory
                {
                    ProductId     = req.ProductId,
                    Name          = accName,
                    Type          = accType,
                    Quantity      = req.Quantity,
                    Unit          = req.Unit,
                    Status        = "Good",
                    Description   = req.Description,
                    IsActive      = true,
                    Created       = DateTime.Now,
                    CreatedBy     = req.StaffId,
                    CreatedByName = req.StaffName
                };
                _context.Accessories.Add(newAcc);
                await _context.SaveChangesAsync();

                await AddCommit(req.StaffId, req.StaffName,
                    req.CommitMessage ?? $"Thêm {(accType == "Equipment" ? "thiết bị" : "phụ kiện")}: {accName}",
                    "Accessory", newAcc.Id, accName, null,
                    JsonSerializer.Serialize(new { quantity = req.Quantity, status = newAcc.Status }));

                return Ok(new { newAcc.Id, message = "Tạo thành công.", updated = false });
            }

            if (string.IsNullOrWhiteSpace(req.Name))
                return BadRequest(new { message = "Tên phụ kiện không được để trống" });

            var accessory = new Accessory
            {
                Name          = req.Name,
                Type          = req.Type ?? "Accessory",
                Quantity      = req.Quantity,
                Unit          = req.Unit,
                Status        = "Good",
                Description   = req.Description,
                IsActive      = true,
                Created       = DateTime.Now,
                CreatedBy     = req.StaffId,
                CreatedByName = req.StaffName
            };
            _context.Accessories.Add(accessory);
            await _context.SaveChangesAsync();

            await AddCommit(req.StaffId, req.StaffName,
                req.CommitMessage ?? $"Thêm {(req.Type == "Equipment" ? "thiết bị" : "phụ kiện")}: {req.Name}",
                "Accessory", accessory.Id, req.Name, null,
                JsonSerializer.Serialize(new { quantity = req.Quantity, status = "Good" }));

            return Ok(new { accessory.Id, message = "Tạo thành công.", updated = false });
        }

        [HttpPut("accessories/{id}")]
        public async Task<IActionResult> UpdateAccessory(int id, [FromBody] AccessoryRequest req)
        {
            var accessory = await _context.Accessories.FindAsync(id);
            if (accessory == null) return NotFound(new { message = "Không tìm thấy phụ kiện" });

            var oldValue = JsonSerializer.Serialize(new { quantity = accessory.Quantity, status = accessory.Status });

            accessory.Name        = req.Name ?? accessory.Name;
            accessory.Type        = req.Type ?? accessory.Type;
            accessory.Quantity    = req.Quantity;
            accessory.Unit        = req.Unit ?? accessory.Unit;
            accessory.Status      = req.Status ?? accessory.Status;
            accessory.Description = req.Description ?? accessory.Description;
            accessory.Modified    = DateTime.Now;

            await _context.SaveChangesAsync();

            await AddCommit(req.StaffId, req.StaffName,
                req.CommitMessage ?? $"Cập nhật {(accessory.Type == "Equipment" ? "thiết bị" : "phụ kiện")}: {accessory.Name}",
                "Accessory", accessory.Id, accessory.Name,
                oldValue,
                JsonSerializer.Serialize(new { quantity = req.Quantity, status = req.Status }));

            return Ok(new { message = "Cập nhật thành công" });
        }

        [HttpDelete("accessories/{id}")]
        public async Task<IActionResult> DeleteAccessory(int id, [FromQuery] string staffId = "", [FromQuery] string staffName = "")
        {
            var accessory = await _context.Accessories.FindAsync(id);
            if (accessory == null) return NotFound(new { message = "Không tìm thấy phụ kiện" });

            await AddCommit(staffId, staffName,
                $"Xoá {(accessory.Type == "Equipment" ? "thiết bị" : "phụ kiện")}: {accessory.Name}",
                "Accessory", accessory.Id, accessory.Name,
                JsonSerializer.Serialize(new { quantity = accessory.Quantity, status = accessory.Status }),
                null);

            accessory.IsActive = false;
            accessory.Modified = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Xoá thành công" });
        }

        // ────────────────────────────────────────────────────────────
        //  GHI NHẬN HAO HỤT
        // ────────────────────────────────────────────────────────────

        [HttpPost("tanks/{id}/loss")]
        public async Task<IActionResult> RecordTankLoss(int id, [FromBody] TankLossRequest req)
        {
            var tank = await _context.TankFishTrackings.FindAsync(id);
            if (tank == null) return NotFound(new { message = "Không tìm thấy bể cá" });

            if (req.MaleLoss < 0 || req.FemaleLoss < 0)
                return BadRequest(new { message = "Số lượng hao hụt không được âm" });
            if (req.MaleLoss > tank.MaleCount || req.FemaleLoss > tank.FemaleCount)
                return BadRequest(new { message = $"Hao hụt vượt quá số hiện có (đực: {tank.MaleCount}, cái: {tank.FemaleCount})" });
            if (string.IsNullOrWhiteSpace(req.Reason))
                return BadRequest(new { message = "Vui lòng nhập lý do" });

            var oldValue = JsonSerializer.Serialize(new { maleCount = tank.MaleCount, femaleCount = tank.FemaleCount });
            tank.MaleCount         -= req.MaleLoss;
            tank.FemaleCount       -= req.FemaleLoss;
            tank.LastUpdated       = DateTime.Now;
            tank.LastUpdatedBy     = req.StaffId;
            tank.LastUpdatedByName = req.StaffName;
            await _context.SaveChangesAsync();

            await AddCommit(req.StaffId, req.StaffName,
                $"Hao hụt {tank.TankName}: -{req.MaleLoss} đực, -{req.FemaleLoss} cái — {req.Reason}",
                "Fish", tank.Id, tank.TankName,
                oldValue,
                JsonSerializer.Serialize(new { maleCount = tank.MaleCount, femaleCount = tank.FemaleCount }));

            return Ok(new { message = $"Đã ghi nhận -{req.MaleLoss} đực, -{req.FemaleLoss} cái khỏi bể {tank.TankName}." });
        }

        [HttpPost("accessories/{id}/loss")]
        public async Task<IActionResult> RecordAccessoryLoss(int id, [FromBody] AccessoryLossRequest req)
        {
            var acc = await _context.Accessories.FindAsync(id);
            if (acc == null || !acc.IsActive) return NotFound(new { message = "Không tìm thấy phụ kiện" });

            if (req.QuantityLoss < 0)
                return BadRequest(new { message = "Số lượng hư hỏng không được âm" });
            if (req.QuantityLoss > acc.Quantity)
                return BadRequest(new { message = $"Số lượng hư hỏng vượt quá tồn kho ({acc.Quantity})" });
            if (string.IsNullOrWhiteSpace(req.Reason))
                return BadRequest(new { message = "Vui lòng nhập lý do" });

            var oldValue = JsonSerializer.Serialize(new { quantity = acc.Quantity, status = acc.Status });
            acc.Quantity -= req.QuantityLoss;
            // Không đổi trạng thái khi ghi nhận hư hỏng — trạng thái chỉ thay đổi qua chức năng Sửa
            acc.Modified = DateTime.Now;
            await _context.SaveChangesAsync();

            await AddCommit(req.StaffId, req.StaffName,
                $"Hư hỏng/mất {acc.Name}: -{req.QuantityLoss} — {req.Reason}",
                "Accessory", acc.Id, acc.Name,
                oldValue,
                JsonSerializer.Serialize(new { quantity = acc.Quantity, status = acc.Status }));

            return Ok(new { message = $"Đã ghi nhận -{req.QuantityLoss} {acc.Name}." });
        }

        // ────────────────────────────────────────────────────────────
        //  ĐỒNG BỘ KHO TỪ PRODUCTS (category cá: 1, 2)
        // ────────────────────────────────────────────────────────────

        private static readonly int[] FishCategoryIds      = [1, 2];
        private static readonly int[] AccessoryCategoryIds = [3, 4, 5];

        private static (int male, int female, string? notes) GetTankCounts(Product p)
        {
            if (p.MaleStock > 0 || p.FemaleStock > 0)
                return (p.MaleStock, p.FemaleStock, null);
            return (p.Stock, 0, "Chưa phân loại giới tính");
        }

        [HttpPost("sync")]
        public async Task<IActionResult> SyncFromProducts(
            [FromQuery] string staffId   = "system",
            [FromQuery] string staffName = "Hệ thống")
        {
            var fishProducts = await _context.Products
                .Where(p => FishCategoryIds.Contains(p.CategoryId)
                         && (p.MaleStock > 0 || p.FemaleStock > 0 || p.Stock > 0))
                .ToListAsync();

            var existingTanks = await _context.TankFishTrackings
                .Where(t => fishProducts.Select(p => p.Id).Contains(t.ProductId))
                .ToListAsync();
            var tankMap = existingTanks.ToDictionary(t => t.ProductId);

            int created = 0, updated = 0;

            foreach (var p in fishProducts)
            {
                var (male, female, notes) = GetTankCounts(p);
                var tankName = p.Name ?? $"Loài #{p.Id}";

                if (!tankMap.TryGetValue(p.Id, out var tank))
                {
                    tank = new TankFishTracking
                    {
                        TankName          = tankName,
                        ProductId         = p.Id,
                        MaleCount         = male,
                        FemaleCount       = female,
                        Notes             = notes,
                        LastUpdated       = DateTime.Now,
                        LastUpdatedBy     = staffId,
                        LastUpdatedByName = staffName
                    };
                    _context.TankFishTrackings.Add(tank);
                    await _context.SaveChangesAsync();

                    await AddCommit(staffId, staffName,
                        $"Đồng bộ kho: tạo bể cho {tankName}",
                        "Fish", tank.Id, tankName, null,
                        JsonSerializer.Serialize(new { maleCount = male, femaleCount = female }));
                    created++;
                }
                else if (tank.MaleCount != male || tank.FemaleCount != female || tank.TankName != tankName)
                {
                    var oldValue = JsonSerializer.Serialize(new { maleCount = tank.MaleCount, femaleCount = tank.FemaleCount });
                    tank.TankName          = tankName;
                    tank.MaleCount         = male;
                    tank.FemaleCount       = female;
                    if (notes != null) tank.Notes = notes;
                    tank.LastUpdated       = DateTime.Now;
                    tank.LastUpdatedBy     = staffId;
                    tank.LastUpdatedByName = staffName;
                    await _context.SaveChangesAsync();

                    await AddCommit(staffId, staffName,
                        $"Đồng bộ kho: cập nhật bể {tankName}",
                        "Fish", tank.Id, tankName, oldValue,
                        JsonSerializer.Serialize(new { maleCount = male, femaleCount = female }));
                    updated++;
                }
            }

            var accProducts = await _context.Products
                .Where(p => AccessoryCategoryIds.Contains(p.CategoryId) && p.Stock > 0)
                .ToListAsync();

            var existingAccs = await _context.Accessories
                .Where(a => a.IsActive && a.ProductId != null &&
                            accProducts.Select(p => (int?)p.Id).Contains(a.ProductId))
                .ToListAsync();
            var accMap = existingAccs.ToDictionary(a => a.ProductId!.Value);

            int accCreated = 0, accUpdated = 0;
            foreach (var p in accProducts)
            {
                var accName = p.Name ?? $"Sản phẩm #{p.Id}";
                var accType = p.CategoryId == 3 ? "Equipment" : "Accessory";

                if (!accMap.TryGetValue(p.Id, out var acc))
                {
                    _context.Accessories.Add(new Accessory
                    {
                        ProductId     = p.Id,
                        Name          = accName,
                        Type          = accType,
                        Quantity      = p.Stock,
                        Status        = "Good",
                        IsActive      = true,
                        Created       = DateTime.Now,
                        CreatedBy     = staffId,
                        CreatedByName = staffName
                    });
                    await _context.SaveChangesAsync();
                    accCreated++;
                }
                else if (acc.Quantity != p.Stock || acc.Name != accName)
                {
                    var oldVal = JsonSerializer.Serialize(new { quantity = acc.Quantity, status = acc.Status });
                    acc.Name     = accName;
                    acc.Quantity = p.Stock;
                    acc.Modified = DateTime.Now;
                    await _context.SaveChangesAsync();

                    await AddCommit(staffId, staffName,
                        $"Đồng bộ kho: cập nhật {accName}",
                        "Accessory", acc.Id, accName, oldVal,
                        JsonSerializer.Serialize(new { quantity = p.Stock, status = acc.Status }));
                    accUpdated++;
                }
            }

            return Ok(new
            {
                fish    = new { created, updated, total = fishProducts.Count },
                acc     = new { created = accCreated, updated = accUpdated, total = accProducts.Count },
                message = $"Đồng bộ hoàn tất — Bể: +{created} mới, ~{updated} cập nhật | Phụ kiện: +{accCreated} mới, ~{accUpdated} cập nhật."
            });
        }

        // ────────────────────────────────────────────────────────────
        //  BÁO CÁO HAO HỤT
        // ────────────────────────────────────────────────────────────

        [HttpGet("report")]
        public async Task<IActionResult> GetLossReport(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string groupBy = "month")
        {
            var q = _context.InventoryCommits
                .Where(c => c.CommitMessage.StartsWith("Hao hụt") ||
                            c.CommitMessage.StartsWith("Hư hỏng/mất"));

            if (from.HasValue) q = q.Where(c => c.Created >= from.Value);
            if (to.HasValue)   q = q.Where(c => c.Created < to.Value.AddDays(1));

            var commits = await q.OrderBy(c => c.Created).ToListAsync();

            // Tra giá đơn vị qua TargetId → Tank/Accessory → Product.Price
            var fishIds = commits.Where(c => c.TargetType == "Fish" && c.TargetId.HasValue)
                .Select(c => c.TargetId!.Value).Distinct().ToList();
            var accIds  = commits.Where(c => c.TargetType == "Accessory" && c.TargetId.HasValue)
                .Select(c => c.TargetId!.Value).Distinct().ToList();

            var fishPriceMap = await _context.TankFishTrackings
                .Where(t => fishIds.Contains(t.Id))
                .Include(t => t.Product)
                .Select(t => new { t.Id, Price = t.Product != null ? t.Product.Price : 0m })
                .ToDictionaryAsync(x => x.Id, x => x.Price);

            var accPriceMap = await _context.Accessories
                .Where(a => accIds.Contains(a.Id))
                .Include(a => a.Product)
                .Select(a => new { a.Id, Price = a.Product != null ? a.Product.Price : 0m })
                .ToDictionaryAsync(x => x.Id, x => x.Price);

            var records = commits.Select(c =>
            {
                var oldCount = c.TargetType == "Fish" ? ParseFishTotal(c.OldValue)  : ParseAccQuantity(c.OldValue);
                var newCount = c.TargetType == "Fish" ? ParseFishTotal(c.NewValue)  : ParseAccQuantity(c.NewValue);
                var lossAmt  = Math.Max(0, oldCount - newCount);
                var price    = c.TargetType == "Fish"
                    ? (c.TargetId.HasValue && fishPriceMap.TryGetValue(c.TargetId.Value, out var fp) ? fp : 0m)
                    : (c.TargetId.HasValue && accPriceMap.TryGetValue(c.TargetId.Value,  out var ap) ? ap : 0m);
                // Trích lý do từ phần sau dấu " — " trong commit message
                var reason = c.CommitMessage.Contains(" — ")
                    ? c.CommitMessage[(c.CommitMessage.IndexOf(" — ") + 3)..].Trim()
                    : "";
                return new
                {
                    c.TargetType,
                    c.TargetName,
                    c.CommitMessage,
                    Reason     = reason,
                    c.StaffName,
                    c.Created,
                    LossAmount = lossAmt,
                    UnitPrice  = price,
                    TotalCost  = lossAmt * price,
                };
            }).ToList();

            Func<DateTime, string> periodKey = groupBy == "day"
                ? d => d.ToString("yyyy-MM-dd")
                : d => d.ToString("yyyy-MM");

            var periods = records
                .GroupBy(r => periodKey(r.Created))
                .Select(g => new
                {
                    period    = g.Key,
                    fishLoss  = g.Where(r => r.TargetType == "Fish").Sum(r => r.LossAmount),
                    accLoss   = g.Where(r => r.TargetType == "Accessory").Sum(r => r.LossAmount),
                    fishCost  = g.Where(r => r.TargetType == "Fish").Sum(r => r.TotalCost),
                    accCost   = g.Where(r => r.TargetType == "Accessory").Sum(r => r.TotalCost),
                    totalCost = g.Sum(r => r.TotalCost),
                    records   = g.OrderByDescending(r => r.Created)
                                  .Select(r => new
                                  {
                                      r.TargetType, r.TargetName, r.CommitMessage, r.Reason,
                                      r.StaffName, r.Created, r.LossAmount, r.UnitPrice, r.TotalCost
                                  })
                })
                .OrderByDescending(g => g.period)
                .ToList();

            return Ok(new
            {
                periods,
                totalFishLoss = records.Where(r => r.TargetType == "Fish").Sum(r => r.LossAmount),
                totalAccLoss  = records.Where(r => r.TargetType == "Accessory").Sum(r => r.LossAmount),
                totalFishCost = records.Where(r => r.TargetType == "Fish").Sum(r => r.TotalCost),
                totalAccCost  = records.Where(r => r.TargetType == "Accessory").Sum(r => r.TotalCost),
                totalCost     = records.Sum(r => r.TotalCost),
                totalRecords  = records.Count,
            });
        }

        // ────────────────────────────────────────────────────────────
        //  COMMIT LOG
        // ────────────────────────────────────────────────────────────

        [HttpGet("commits")]
        public async Task<IActionResult> GetCommits(
            [FromQuery] string? staffId,
            [FromQuery] string? targetType,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 30)
        {
            var query = _context.InventoryCommits.AsQueryable();

            if (!string.IsNullOrWhiteSpace(staffId))
                query = query.Where(c => c.StaffId == staffId);
            if (!string.IsNullOrWhiteSpace(targetType))
                query = query.Where(c => c.TargetType == targetType);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(c => c.Created)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { items, total, page, pageSize, totalPages = (int)Math.Ceiling((double)total / pageSize) });
        }

        // ────────────────────────────────────────────────────────────
        //  HELPERS
        // ────────────────────────────────────────────────────────────

        private async Task AddCommit(string staffId, string staffName, string message,
            string targetType, int? targetId, string targetName,
            string? oldValue, string? newValue)
        {
            _context.InventoryCommits.Add(new InventoryCommit
            {
                StaffId       = staffId,
                StaffName     = staffName,
                CommitMessage = message,
                TargetType    = targetType,
                TargetId      = targetId,
                TargetName    = targetName,
                OldValue      = oldValue,
                NewValue      = newValue,
                Created       = DateTime.Now
            });
            await _context.SaveChangesAsync();
        }

        // Đọc tổng cá (đực + cái) từ JSON — hỗ trợ cả camelCase và PascalCase
        private static int ParseFishTotal(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return 0;
            try
            {
                var doc  = JsonDocument.Parse(json);
                var root = doc.RootElement;
                int male = 0, female = 0;
                if (root.TryGetProperty("maleCount",   out var m) && m.TryGetInt32(out var mi)) male   = mi;
                else if (root.TryGetProperty("MaleCount", out var M) && M.TryGetInt32(out var Mi)) male = Mi;
                if (root.TryGetProperty("femaleCount",   out var f) && f.TryGetInt32(out var fi)) female   = fi;
                else if (root.TryGetProperty("FemaleCount", out var F) && F.TryGetInt32(out var Fi)) female = Fi;
                return male + female;
            }
            catch { return 0; }
        }

        // Đọc số lượng phụ kiện từ JSON — hỗ trợ cả camelCase và PascalCase
        private static int ParseAccQuantity(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return 0;
            try
            {
                var doc  = JsonDocument.Parse(json);
                var root = doc.RootElement;
                if (root.TryGetProperty("quantity", out var q) && q.TryGetInt32(out var qi)) return qi;
                if (root.TryGetProperty("Quantity", out var Q) && Q.TryGetInt32(out var Qi)) return Qi;
                return 0;
            }
            catch { return 0; }
        }
    }

    // ────────────────────────────────────────────────────────────
    //  REQUEST DTOs
    // ────────────────────────────────────────────────────────────

    public class TankRequest
    {
        public string TankName { get; set; } = "";
        public int ProductId { get; set; }
        public int MaleCount { get; set; }
        public int FemaleCount { get; set; }
        public string? Notes { get; set; }
        public string StaffId { get; set; } = "";
        public string StaffName { get; set; } = "";
        public string? CommitMessage { get; set; }
    }

    public class TankLossRequest
    {
        public int MaleLoss { get; set; }
        public int FemaleLoss { get; set; }
        public string Reason { get; set; } = "";
        public string StaffId { get; set; } = "";
        public string StaffName { get; set; } = "";
    }

    public class AccessoryLossRequest
    {
        public int QuantityLoss { get; set; }
        public string Reason { get; set; } = "";
        public string StaffId { get; set; } = "";
        public string StaffName { get; set; } = "";
    }

    public class AccessoryRequest
    {
        public int? ProductId { get; set; }
        public string Name { get; set; } = "";
        public string? Type { get; set; }
        public int Quantity { get; set; }
        public string? Unit { get; set; }
        public string? Status { get; set; }
        public string? Description { get; set; }
        public string StaffId { get; set; } = "";
        public string StaffName { get; set; } = "";
        public string? CommitMessage { get; set; }
    }
}
