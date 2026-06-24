import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './admin.css'

export default function AdminLayout({ children }) {
  const { user, logout, isAdmin, isWarehouse } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    document.body.classList.add('layout-fixed', 'layout-navbar-fixed')
    return () => {
      document.body.classList.remove('layout-fixed', 'layout-navbar-fixed')
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link'

  return (
    <div className="wrapper">
      {/* Navbar */}
      <nav className="main-header navbar navbar-expand navbar-white navbar-light">
        <ul className="navbar-nav">
          <li className="nav-item">
            <a className="nav-link" data-widget="pushmenu" href="#" role="button">
              <i className="fas fa-bars"></i>
            </a>
          </li>
          <li className="nav-item d-none d-sm-inline-block">
            <Link to="/admin" className="nav-link">Dashboard</Link>
          </li>
        </ul>
        <ul className="navbar-nav ml-auto">
          {/* FIX 4: Nút chuyển về giao diện khách hàng */}
          <li className="nav-item mr-2">
            <Link
              to="/"
              className="btn btn-sm btn-outline-info"
              style={{ marginTop: 8 }}
              title="Xem giao diện khách hàng"
            >
              <i className="fas fa-store mr-1"></i> Xem cửa hàng
            </Link>
          </li>
          <li className="nav-item dropdown">
            <a className="nav-link" data-toggle="dropdown" href="#">
              <i className="far fa-user"></i> {user?.username || user?.name || 'Admin'}
            </a>
            <div className="dropdown-menu dropdown-menu-right">
              <button className="dropdown-item" onClick={handleLogout}>
                <i className="fas fa-sign-out-alt mr-2"></i> Đăng xuất
              </button>
            </div>
          </li>
        </ul>
      </nav>

      {/* Sidebar */}
      <aside className="main-sidebar sidebar-dark-primary elevation-4">
        <Link to="/admin" className="brand-link">
          <i className="fas fa-tint ml-3 mr-1" style={{ color: '#a8d5f0', fontSize: '1.1rem' }}></i>
          <span className="brand-text font-weight-light">
            <strong>AquaViet</strong> Admin
          </span>
        </Link>
        <div className="sidebar">
          <div className="user-panel mt-3 pb-3 mb-3 d-flex">
            <div className="image">
              <i className="fas fa-user-circle fa-2x text-white ml-1"></i>
            </div>
            <div className="info">
              <span className="d-block text-white">{user?.username || user?.name}</span>
              <small className="text-muted">
                {isAdmin() ? 'Quản trị viên' : isWarehouse() ? 'Quản lý kho' : 'Người dùng'}
              </small>
            </div>
          </div>
          <nav className="mt-2">
            <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu">
              {/* Menu chung: Dashboard (chỉ admin) */}
              {isAdmin() && (
                <li className="nav-item">
                  <Link to="/admin" className={isActive('/admin')}>
                    <i className="nav-icon fas fa-tachometer-alt"></i>
                    <p>Dashboard</p>
                  </Link>
                </li>
              )}

              {/* Menu Quản lý kho - hiển thị cho cả admin và warehouse */}
              <li className="nav-header" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', padding: '0.6rem 1rem 0.2rem' }}>QUẢN LÝ KHO</li>
              <li className="nav-item">
                <Link to="/admin/warehouse" className={isActive('/admin/warehouse')}>
                  <i className="nav-icon fas fa-warehouse"></i>
                  <p>Quản lý kho</p>
                </Link>
              </li>
              {/* Menu chỉ dành cho Admin */}
              {isAdmin() && (
                <>
                  <li className="nav-header" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', padding: '0.6rem 1rem 0.2rem' }}>QUẢN TRỊ HỆ THỐNG</li>
                  <li className="nav-item">
                    <Link to="/admin/products" className={isActive('/admin/products')}>
                      <i className="nav-icon fas fa-box"></i>
                      <p>Sản phẩm</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link to="/admin/categories" className={isActive('/admin/categories')}>
                      <i className="nav-icon fas fa-tags"></i>
                      <p>Danh mục</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link to="/admin/orders" className={isActive('/admin/orders')}>
                      <i className="nav-icon fas fa-receipt"></i>
                      <p>Đơn hàng</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link to="/admin/blogs" className={isActive('/admin/blogs')}>
                      <i className="nav-icon fas fa-blog"></i>
                      <p>Blog</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link to="/admin/users" className={isActive('/admin/users')}>
                      <i className="nav-icon fas fa-users"></i>
                      <p>Người dùng</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link to="/admin/statistics" className={isActive('/admin/statistics')}>
                      <i className="nav-icon fas fa-chart-bar"></i>
                      <p>Thống kê</p>
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link to="/admin/internal-notifications" className={isActive('/admin/internal-notifications')}>
                      <i className="nav-icon fas fa-bell"></i>
                      <p>Thông báo nội bộ</p>
                    </Link>
                  </li>
                </>
              )}

              <li className="nav-item mt-3">
                <Link to="/" className="nav-link" style={{ background: 'rgba(168,213,240,0.15)', borderRadius: 6 }}>
                  <i className="nav-icon fas fa-store" style={{ color: '#a8d5f0' }}></i>
                  <p style={{ color: '#a8d5f0', fontWeight: 600 }}>← Về cửa hàng</p>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="content-wrapper">
        {children}
      </div>

      <footer className="main-footer">
        <strong>AquaViet Admin</strong> — BaseCore Sales System
      </footer>

      <aside className="control-sidebar control-sidebar-dark"></aside>
    </div>
  )
}