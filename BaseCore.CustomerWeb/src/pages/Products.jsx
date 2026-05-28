import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { productService } from '../services/product/productService'
import { categoryService } from '../services/category/categoryService'
import ProductCard from '../components/ProductCard'
import styles from './Products.module.css'

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const catFilter = searchParams.get('cat') || ''
  const query = searchParams.get('q') || ''
  const [sort, setSort] = useState('default')
  const [priceRange, setPriceRange] = useState(3000000)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)   // tổng TRƯỚC khi lọc giá local
  const [totalPages, setTotalPages] = useState(1)

  // FIX 9: reset về page 1 khi đổi danh mục hoặc query
  useEffect(() => {
    setPage(1)
  }, [catFilter, query])

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const categoryId = catFilter ? parseInt(catFilter) : null
        const res = await productService.getAll(query, categoryId, page, pageSize)
        setProducts(res.items || [])
        setTotalCount(res.totalCount || 0)
        setTotalPages(res.totalPages || Math.ceil((res.totalCount || 0) / pageSize))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [query, catFilter, page])

  // Fetch categories
  useEffect(() => {
    categoryService.getAll()
      .then(res => setCategories(res))
      .catch(() => {})
  }, [])

  // Sort locally
  const sorted = [...products].sort((a, b) => {
    if (sort === 'price-asc') return (a.price || 0) - (b.price || 0)
    if (sort === 'price-desc') return (b.price || 0) - (a.price || 0)
    if (sort === 'rating') return (b.rating || 0) - (a.rating || 0)
    return 0
  })

  // Filter by price locally
  const filtered = sorted.filter(p => (p.price || 0) <= priceRange)

  const handleCategoryClick = (id) => {
    // FIX 9: reset page về 1 khi chọn danh mục
    setPage(1)
    if (id === 'all') {
      setSearchParams({})
    } else {
      setSearchParams({ cat: id })
    }
  }

  // FIX 8: hiển thị đúng số sản phẩm
  // - filtered.length: số hiển thị trên trang hiện tại (sau lọc giá)
  // - totalCount: tổng từ server (dùng cho pagination)
  const displayCount = query || catFilter
    ? totalCount   // khi có filter server → dùng totalCount
    : totalCount   // luôn hiển thị tổng từ server

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.filterGroup}>
            <h3>Danh mục</h3>
            <button
              className={`${styles.catBtn} ${!catFilter ? styles.active : ''}`}
              onClick={() => handleCategoryClick('all')}
            >
              {/* FIX 8: hiển thị tổng đúng */}
              Tất cả ({totalCount})
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                className={`${styles.catBtn} ${catFilter === c.id.toString() ? styles.active : ''}`}
                onClick={() => handleCategoryClick(c.id)}
              >
                📦 {c.name}
              </button>
            ))}
          </div>

          <div className={styles.filterGroup}>
            <h3>Giá tối đa</h3>
            <input
              type="range" min={10000} max={3000000} step={10000}
              value={priceRange}
              onChange={e => setPriceRange(+e.target.value)}
              className={styles.range}
            />
            <div className={styles.rangeLabel}>
              <span>0đ</span>
              <span>{priceRange.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className={styles.main}>
          <div className={styles.toolbar}>
            <p className={styles.count}>
              {query ? `Kết quả cho "${query}": ` : ''}
              {/* FIX 8: hiển thị số đúng — filtered.length cho biết bao nhiêu đang hiển thị */}
              <strong>{filtered.length}</strong> sản phẩm
              {filtered.length !== totalCount && totalCount > 0 && (
                <span style={{ color: '#9ca3af', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
                  (tổng {totalCount})
                </span>
              )}
            </p>
            <select className={styles.sort} value={sort} onChange={e => setSort(e.target.value)}>
              <option value="default">Mặc định</option>
              <option value="price-asc">Giá tăng dần</option>
              <option value="price-desc">Giá giảm dần</option>
              <option value="rating">Đánh giá cao nhất</option>
            </select>
          </div>

          {loading ? (
            <div className={styles.empty}><span>⏳</span><p>Đang tải...</p></div>
          ) : error ? (
            <div className={styles.empty}><span>❌</span><p>Lỗi: {error}</p></div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}><span>🔍</span><p>Không tìm thấy sản phẩm phù hợp</p></div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}

          {/* FIX 9: Pagination dùng totalPages từ server, không dùng filtered.length */}
          {!loading && totalCount > 0 && (
            <div className={styles.pagination}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Trước</button>
              <span>Trang {page} / {totalPages || 1}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Tiếp →</button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}