import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { categoryService } from '../services/category/categoryService'
import styles from './Header.module.css'

export default function Header() {
  const { count } = useCart()
  const { user, logout, isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    categoryService.getAll()
      .then(res => setCategories(res))
      .catch(() => {})
  }, [])

  const handleSearch = e => {
    e.preventDefault()
    if (search.trim()) navigate(`/products?q=${encodeURIComponent(search.trim())}`)
  }

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    navigate('/')
  }

  return (
    <header className={styles.header}>
      <div className={styles.topBar}>
        <span>🚚 Miễn phí vận chuyển đơn từ 500.000đ</span>
        <span>📞 Tư vấn: 1800-AQUA</span>
      </div>
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon}>🐠</span>
          <span className={styles.logoText}>AquaViet</span>
        </Link>

        <button className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
          <span /><span /><span />
        </button>

        <ul className={`${styles.menu} ${menuOpen ? styles.open : ''}`}>
          <li><Link to="/products" onClick={() => setMenuOpen(false)}>Tất cả sản phẩm</Link></li>
          {categories.map(cat => (
            <li key={cat.id}>
              <Link to={`/products?cat=${cat.id}`} onClick={() => setMenuOpen(false)}>{cat.name}</Link>
            </li>
          ))}
          <li><Link to="/blog" onClick={() => setMenuOpen(false)}>Blog</Link></li>
        </ul>

        <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Tìm kiếm sản phẩm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button type="submit">🔍</button>
        </form>

        <div className={styles.rightNav}>
          {/* Nút giỏ hàng */}
          <Link to="/cart" className={styles.cartBtn}>
            <span className={styles.cartIcon}>🛒</span>
            {count > 0 && <span className={styles.badge}>{count}</span>}
          </Link>

          {/* Nút đơn hàng — chỉ hiện khi đã đăng nhập */}
          {user && (
            <Link to="/orders" className={styles.ordersBtn} title="Đơn hàng của tôi">
              📦
            </Link>
          )}

          {user ? (
            <div className={styles.userMenu}>
              <button className={styles.userBtn} onClick={() => setUserMenuOpen(!userMenuOpen)}>
                👤 {user.name || user.username}
              </button>
              {userMenuOpen && (
                <div className={styles.userDropdown}>
                  <div className={styles.userInfo}>
                    <p><strong>{user.username}</strong></p>
                    <p>{user.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    style={{ display: 'block', padding: '8px 12px', textDecoration: 'none', color: '#333', borderRadius: 6 }}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    👤 Thông tin tài khoản
                  </Link>
                  <Link
                    to="/orders"
                    style={{ display: 'block', padding: '8px 12px', textDecoration: 'none', color: '#333', borderRadius: 6 }}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    📦 Đơn hàng của tôi
                  </Link>

                  <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #eee' }} />

                  {isAdmin() && (
                    <Link
                      to="/admin"
                      style={{
                        display: 'block', padding: '8px 12px', textDecoration: 'none', fontWeight: 600,
                        color: '#fff', background: 'linear-gradient(90deg,#1565c0,#1976d2)',
                        borderRadius: 6, margin: '6px 0', textAlign: 'center',
                      }}
                      onClick={() => setUserMenuOpen(false)}
                    >
                      ⚙️ Vào trang Admin
                    </Link>
                  )}

                  <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #eee' }} />
                  <button onClick={handleLogout} className={styles.logoutBtn}>Đăng Xuất</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className={styles.loginBtn}>Đăng Nhập</Link>
          )}
        </div>
      </nav>
    </header>
  )
}