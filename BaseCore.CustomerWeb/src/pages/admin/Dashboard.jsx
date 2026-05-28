import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { productService } from '../../services/product/productService'
import { categoryService } from '../../services/category/categoryService'
import { userService } from '../../services/user/userService'
import { useAuth } from '../../context/AuthContext'

export default function Dashboard() {
  const [stats, setStats] = useState({ products: 0, categories: 0, users: 0 })
  const [loading, setLoading] = useState(true)
  const { isAdmin: isAdminFn } = useAuth()

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          productService.getAll('', null, 1, 1),
          categoryService.getAll(),
        ])

        // Products: { items, totalCount, ... }
        const productCount = productsRes.totalCount ?? productsRes.items?.length ?? 0

        // Categories: array thẳng
        const categoryCount = Array.isArray(categoriesRes)
          ? categoriesRes.length
          : categoriesRes.data?.length ?? 0

        let usersCount = 0
        if (isAdminFn()) {
          try {
            const usersRes = await userService.getAll({ page: 1, pageSize: 1 })
            // Hỗ trợ nhiều format response
            usersCount = usersRes.totalCount
              ?? usersRes.data?.totalCount
              ?? usersRes.data?.length
              ?? 0
          } catch {
            console.log('Cannot fetch users count')
          }
        }

        setStats({ products: productCount, categories: categoryCount, users: usersCount })
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  return (
    <>
      <div className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1 className="m-0">
                <i className="fas fa-tachometer-alt mr-2"></i>Dashboard
              </h1>
            </div>
            <div className="col-sm-6">
              <ol className="breadcrumb float-sm-right">
                <li className="breadcrumb-item active">Trang chủ</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <section className="content">
        <div className="container-fluid">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="col-lg-3 col-6">
                <div className="small-box bg-info">
                  <div className="inner">
                    <h3>{stats.products}</h3>
                    <p>Sản phẩm</p>
                  </div>
                  <div className="icon"><i className="fas fa-box"></i></div>
                  <Link to="/admin/products" className="small-box-footer">
                    Quản lý <i className="fas fa-arrow-circle-right"></i>
                  </Link>
                </div>
              </div>
              <div className="col-lg-3 col-6">
                <div className="small-box bg-success">
                  <div className="inner">
                    <h3>{stats.categories}</h3>
                    <p>Danh mục</p>
                  </div>
                  <div className="icon"><i className="fas fa-tags"></i></div>
                  <Link to="/admin/categories" className="small-box-footer">
                    Quản lý <i className="fas fa-arrow-circle-right"></i>
                  </Link>
                </div>
              </div>
              {isAdminFn() && (
                <div className="col-lg-3 col-6">
                  <div className="small-box bg-warning">
                    <div className="inner">
                      <h3>{stats.users}</h3>
                      <p>Người dùng</p>
                    </div>
                    <div className="icon"><i className="fas fa-users"></i></div>
                    <Link to="/admin/users" className="small-box-footer">
                      Quản lý <i className="fas fa-arrow-circle-right"></i>
                    </Link>
                  </div>
                </div>
              )}
              <div className="col-lg-3 col-6">
                <div className="small-box bg-danger">
                  <div className="inner">
                    <h3><i className="fas fa-blog"></i></h3>
                    <p>Blog</p>
                  </div>
                  <div className="icon"><i className="fas fa-rss"></i></div>
                  <Link to="/admin/blogs" className="small-box-footer">
                    Quản lý <i className="fas fa-arrow-circle-right"></i>
                  </Link>
                </div>
              </div>
              <div className="col-lg-3 col-6">
                <div className="small-box" style={{ background: 'linear-gradient(135deg, #5ba3d9, #7bbce6)' }}>
                  <div className="inner">
                    <h3><i className="fas fa-receipt"></i></h3>
                    <p>Đơn hàng</p>
                  </div>
                  <div className="icon"><i className="fas fa-shopping-bag"></i></div>
                  <Link to="/admin/orders" className="small-box-footer">
                    Quản lý <i className="fas fa-arrow-circle-right"></i>
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="fas fa-tint mr-2"></i>
                    AquaViet — Hệ thống quản lý
                  </h3>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <h5>Chức năng</h5>
                      <ul>
                        <li>Quản lý sản phẩm (CRUD, tìm kiếm, phân trang)</li>
                        <li>Quản lý danh mục</li>
                        <li>Quản lý bài viết blog</li>
                        <li>Quản lý người dùng (Admin)</li>
                      </ul>
                    </div>
                    <div className="col-md-6">
                      <h5>Công nghệ</h5>
                      <ul>
                        <li><strong>Backend:</strong> .NET Core 8 + EF Core</li>
                        <li><strong>Frontend:</strong> React 18 + React Router</li>
                        <li><strong>UI:</strong> AdminLTE 3 + Bootstrap 4</li>
                        <li><strong>Auth:</strong> JWT Bearer Token</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>
    </>
  )
}   