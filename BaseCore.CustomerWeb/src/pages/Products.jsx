import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { productService } from '../services/product/productService'
import { categoryService } from '../services/category/categoryService'
import ProductCard from '../components/ProductCard'
import styles from './Products.module.css'

const STEP = 10000

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const catFilter = searchParams.get('cat') || ''
  const query = searchParams.get('q') || ''

  const [sort, setSort] = useState('default')
  const [maxPriceCap, setMaxPriceCap] = useState(null) // null = đang fetch
  const [minVal, setMinVal] = useState(0)
  const [maxVal, setMaxVal] = useState(0)
  const [minPrice, setMinPrice] = useState(null)
  const [maxPrice, setMaxPrice] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const commitPrice = () => {
    setMinPrice(minVal > 0 ? minVal : null)
    setMaxPrice(maxVal < maxPriceCap ? maxVal : null)
  }

  const resetPrice = () => {
    setMinVal(0)
    setMaxVal(maxPriceCap)
    setMinPrice(null)
    setMaxPrice(null)
  }

  // reset về page 1 khi đổi filter hoặc sort
  useEffect(() => {
    setPage(1)
  }, [catFilter, query, sort, minPrice, maxPrice])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const categoryId = catFilter ? parseInt(catFilter) : null
        // price-asc / price-desc sắp xếp ở server; rating sắp xếp ở client
        const serverSort = (sort === 'price-asc' || sort === 'price-desc') ? sort : null
        const res = await productService.getAll(query, categoryId, page, pageSize, minPrice, maxPrice, serverSort)
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
  }, [query, catFilter, page, sort, minPrice, maxPrice])

  useEffect(() => {
    productService.getMaxPrice()
      .then(data => {
        const cap = Math.max(data.maxPrice || 0, STEP * 2)
        setMaxPriceCap(cap)
        setMaxVal(cap)
      })
      .catch(() => {
        setMaxPriceCap(10000000)
        setMaxVal(10000000)
      })
  }, [])

  useEffect(() => {
    categoryService.getAll()
      .then(res => setCategories(res))
      .catch(() => {})
  }, [])

  // rating sort là client-side (sắp xếp trong trang hiện tại)
  const displayed = sort === 'rating'
    ? [...products].sort((a, b) => (b.rating || 0) - (a.rating || 0))
    : products

  const handleCategoryClick = (id) => {
    setPage(1)
    if (id === 'all') {
      setSearchParams({})
    } else {
      setSearchParams({ cat: id })
    }
  }

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
            <h3>Khoảng giá</h3>
            {maxPriceCap === null ? (
              <p style={{ fontSize: '0.85rem', color: '#aaa' }}>Đang tải...</p>
            ) : (
              <>
                <div className={styles.dualRange}>
                  <div className={styles.dualRangeTrack}>
                    <div
                      className={styles.dualRangeFill}
                      style={{
                        left: `${(minVal / maxPriceCap) * 100}%`,
                        width: `${((maxVal - minVal) / maxPriceCap) * 100}%`
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0} max={maxPriceCap} step={STEP}
                    value={minVal}
                    onChange={e => setMinVal(Math.min(+e.target.value, maxVal - STEP))}
                    onMouseUp={commitPrice}
                    onTouchEnd={commitPrice}
                    className={styles.rangeInput}
                    style={{ zIndex: minVal >= maxVal - STEP ? 5 : undefined }}
                  />
                  <input
                    type="range"
                    min={0} max={maxPriceCap} step={STEP}
                    value={maxVal}
                    onChange={e => setMaxVal(Math.max(+e.target.value, minVal + STEP))}
                    onMouseUp={commitPrice}
                    onTouchEnd={commitPrice}
                    className={styles.rangeInput}
                  />
                </div>
                <div className={styles.rangeLabels}>
                  <span>{minVal > 0 ? minVal.toLocaleString('vi-VN') + 'đ' : '0đ'}</span>
                  <span>{maxVal.toLocaleString('vi-VN')}đ</span>
                </div>
                {(minPrice != null || maxPrice != null) && (
                  <button className={styles.clearPriceBtn} onClick={resetPrice}>
                    Xóa bộ lọc giá
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className={styles.main}>
          <div className={styles.toolbar}>
            <p className={styles.count}>
              {query ? `Kết quả cho "${query}": ` : ''}
              <strong>{totalCount}</strong> sản phẩm
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
          ) : displayed.length === 0 ? (
            <div className={styles.empty}><span>🔍</span><p>Không tìm thấy sản phẩm phù hợp</p></div>
          ) : (
            <div className={styles.grid}>
              {displayed.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}

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
