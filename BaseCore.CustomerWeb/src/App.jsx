import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Header from './components/Header'
import Footer from './components/Footer'
import AdminLayout from './pages/admin/AdminLayout'

// Customer pages
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Blog from './pages/Blog'
import BlogDetail from './pages/BlogDetail'
import Login from './pages/Login'
import OrderHistory from './pages/OrderHistory'
import Payment from './pages/Payment'
import Profile from './pages/Profile'

// Admin pages
import Dashboard from './pages/admin/Dashboard'
import AdminProducts from './pages/admin/Products'
import AdminCategories from './pages/admin/Categories'
import AdminBlogs from './pages/admin/Blogs'
import AdminUsers from './pages/admin/Users'
import AdminOrders from './pages/admin/Orders'
import AdminStatistics from './pages/admin/Statistics'
import Warehouse from './pages/admin/Warehouse'
import InternalNotifications from './pages/admin/InternalNotifications'

// Guard: chỉ cho vào nếu đã login và là admin
function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  const role = (user.role || user.Role || '').toLowerCase()
  if (role !== 'admin') return <Navigate to="/" replace />
  return <AdminLayout>{children}</AdminLayout>
}

// Guard: admin hoặc warehouse đều được vào
function WarehouseRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  const role = (user.role || user.Role || '').toLowerCase()
  if (role !== 'admin' && role !== 'warehouse') return <Navigate to="/" replace />
  return <AdminLayout>{children}</AdminLayout>
}

function CustomerLayout({ children }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* Customer */}
            <Route path="/" element={<CustomerLayout><Home /></CustomerLayout>} />
            <Route path="/products" element={<CustomerLayout><Products /></CustomerLayout>} />
            <Route path="/product/:id" element={<CustomerLayout><ProductDetail /></CustomerLayout>} />
            <Route path="/cart" element={<CustomerLayout><Cart /></CustomerLayout>} />
            <Route path="/blog" element={<CustomerLayout><Blog /></CustomerLayout>} />
            <Route path="/blog/:id" element={<CustomerLayout><BlogDetail /></CustomerLayout>} />
            <Route path="/login" element={<Login />} />
            <Route path="/orders" element={<CustomerLayout><OrderHistory /></CustomerLayout>} />
            <Route path="/payment/:orderId" element={<CustomerLayout><Payment /></CustomerLayout>} />
            <Route path="/profile" element={<CustomerLayout><Profile /></CustomerLayout>} />

            {/* Admin */}
            <Route path="/admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
            <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
            <Route path="/admin/blogs" element={<AdminRoute><AdminBlogs /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/statistics" element={<AdminRoute><AdminStatistics /></AdminRoute>} />
            <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
            <Route path="/admin/warehouse" element={<WarehouseRoute><Warehouse /></WarehouseRoute>} />
            <Route path="/admin/internal-notifications" element={<AdminRoute><InternalNotifications /></AdminRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}   
