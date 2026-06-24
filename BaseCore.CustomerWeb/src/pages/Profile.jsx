import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { userService } from '../services/user/userService'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [msg, setMsg] = useState(null)
  const [pwMsg, setPwMsg] = useState(null)

  useEffect(() => {
    userService.getMe()
      .then(data => {
        setForm({ name: data.name || '', email: data.email || '', phone: data.phone || '' })
      })
      .catch(() => {
        setForm({ name: user?.name || '', email: user?.email || '', phone: '' })
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const res = await userService.updateMe({
        name: form.name,
        email: form.email,
        phone: form.phone,
      })
      updateUser({ name: res.user?.name || form.name, email: res.user?.email || form.email })
      setMsg({ type: 'success', text: 'Cập nhật thông tin thành công!' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Cập nhật thất bại' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePw = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' })
      return
    }
    if (pwForm.newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
      return
    }
    setSavingPw(true)
    try {
      await userService.updateMe({
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      })
      setPwMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' })
      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Đổi mật khẩu thất bại' })
    } finally {
      setSavingPw(false)
    }
  }

  if (loading) return <div style={styles.page}><p>Đang tải...</p></div>

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Tài khoản của tôi</h1>

        {/* Thông tin cơ bản */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Thông tin cá nhân</h2>
          <form onSubmit={handleSave}>
            <div style={styles.row}>
              <label style={styles.label}>Tên hiển thị</label>
              <input
                style={styles.input}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Họ tên"
              />
            </div>
            <div style={styles.row}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
              />
            </div>
            <div style={styles.row}>
              <label style={styles.label}>Số điện thoại</label>
              <input
                style={styles.input}
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Số điện thoại"
              />
            </div>
            {msg && (
              <p style={{ color: msg.type === 'success' ? '#2e7d32' : '#c62828', marginBottom: 12 }}>
                {msg.text}
              </p>
            )}
            <button style={styles.btn} type="submit" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </form>
        </section>

        {/* Đổi mật khẩu */}
        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Đổi mật khẩu</h2>
          <form onSubmit={handleChangePw}>
            <div style={styles.row}>
              <label style={styles.label}>Mật khẩu hiện tại</label>
              <input
                style={styles.input}
                type="password"
                value={pwForm.oldPassword}
                onChange={e => setPwForm({ ...pwForm, oldPassword: e.target.value })}
                placeholder="Mật khẩu hiện tại"
              />
            </div>
            <div style={styles.row}>
              <label style={styles.label}>Mật khẩu mới</label>
              <input
                style={styles.input}
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                placeholder="Ít nhất 6 ký tự"
              />
            </div>
            <div style={styles.row}>
              <label style={styles.label}>Xác nhận mật khẩu</label>
              <input
                style={styles.input}
                type="password"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                placeholder="Nhập lại mật khẩu mới"
              />
            </div>
            {pwMsg && (
              <p style={{ color: pwMsg.type === 'success' ? '#2e7d32' : '#c62828', marginBottom: 12 }}>
                {pwMsg.text}
              </p>
            )}
            <button style={styles.btn} type="submit" disabled={savingPw}>
              {savingPw ? 'Đang đổi...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '80vh',
    background: '#f5f5f5',
    padding: '40px 16px',
  },
  container: {
    maxWidth: 600,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    color: '#1565c0',
    margin: 0,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '28px 32px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#333',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: '2px solid #e3f2fd',
  },
  row: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #ddd',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  },
  btn: {
    background: 'linear-gradient(90deg, #1565c0, #1976d2)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '11px 28px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
