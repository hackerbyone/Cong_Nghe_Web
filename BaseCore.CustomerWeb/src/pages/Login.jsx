import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services/auth/authService'
import styles from './Login.module.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')  // FIX: thêm phone

  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (isRegister) {
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp')
        return
      }
      if (!phone.trim()) {
        setError('Vui lòng nhập số điện thoại')
        return
      }
    }

    setLoading(true)
    try {
      let response
      if (isRegister) {
        response = await authService.register(username, password, email, name, phone)
        login(response)
      } else {
        response = await authService.login(username, password)
        login(response)
      }

      const userRole = (response.role || response.Role || 'user').toLowerCase()
      navigate(userRole === 'admin' ? '/admin' : '/')
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setIsRegister(!isRegister)
    setError('')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setEmail('')
    setName('')
    setPhone('')
  }

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <h1>{isRegister ? 'Đăng Ký' : 'Đăng Nhập'}</h1>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className={styles.group}>
                <label>Họ tên *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Nhập họ và tên"
                />
              </div>
              <div className={styles.group}>
                <label>Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="example@email.com"
                />
              </div>
              {/* FIX: thêm field số điện thoại */}
              <div className={styles.group}>
                <label>Số điện thoại *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  placeholder="0912 345 678"
                />
              </div>
            </>
          )}

          <div className={styles.group}>
            <label>Tên đăng nhập *</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="Nhập tên đăng nhập"
            />
          </div>

          <div className={styles.group}>
            <label>Mật khẩu *</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Ít nhất 6 ký tự"
              minLength={6}
            />
          </div>

          {/* FIX: thêm xác nhận mật khẩu khi register */}
          {isRegister && (
            <div className={styles.group}>
              <label>Xác nhận mật khẩu *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                placeholder="Nhập lại mật khẩu"
                minLength={6}
              />
            </div>
          )}

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Đang xử lý...' : isRegister ? 'Đăng Ký' : 'Đăng Nhập'}
          </button>
        </form>

        <p className={styles.toggle}>
          {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
          <button type="button" onClick={switchMode} className={styles.link}>
            {isRegister ? 'Đăng Nhập' : 'Đăng Ký'}
          </button>
        </p>

        <p className={styles.back}>
          <Link to="/">← Quay lại trang chủ</Link>
        </p>
      </div>
    </main>
  )
}