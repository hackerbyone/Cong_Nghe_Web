import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { orderService } from '../services/order/orderService'
import styles from './Payment.module.css'

const ACCOUNT_NO   = '0827027392472'
const ACCOUNT_NAME = 'SHOP CA CANH'
const BANK_NAME    = 'MBBank (Ngân hàng Quân đội)'

function formatPrice(n) {
  return Number(n || 0).toLocaleString('vi-VN') + 'đ'
}

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const STATUS_LABELS = {
  WaitingDeposit: { text: 'Chờ đặt cọc',   color: '#e65100', bg: '#fff3e0' },
  DepositPaid:    { text: 'Đã đặt cọc',     color: '#1565c0', bg: '#e3f2fd' },
  Processing:     { text: 'Đang xử lý',     color: '#6a1b9a', bg: '#f3e5f5' },
  Shipping:       { text: 'Đang giao hàng', color: '#00695c', bg: '#e0f2f1' },
  Completed:      { text: 'Hoàn thành',     color: '#2e7d32', bg: '#e8f5e9' },
  Cancelled:      { text: 'Đã hủy',         color: '#c62828', bg: '#ffebee' },
}

export default function Payment() {
  const { orderId }  = useParams()
  const navigate     = useNavigate()
  const location     = useLocation()
  const { user, loading: authLoading } = useAuth()

  const initialData  = location.state?.order || null
  const [order, setOrder]             = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [timeLeft, setTimeLeft]       = useState(null)
  const [cancelTimeLeft, setCancelTimeLeft] = useState(null)
  const [copied, setCopied]           = useState(null)
  const [status, setStatus]           = useState(initialData?.status || 'WaitingDeposit')
  const [cancelling, setCancelling]   = useState(false)
  const [cancelError, setCancelError] = useState(null)

  /* Giá trị hiển thị — ưu tiên order đã fetch, fallback initialData */
  const depositAmount  = order?.depositAmount  ?? initialData?.depositAmount  ?? 0
  const totalAmount    = order?.totalAmount    ?? initialData?.totalAmount    ?? 0
  const customerName   = order?.customerName   ?? initialData?.customerName   ?? ''
  const customerPhone  = order?.customerPhone  ?? initialData?.customerPhone  ?? ''
  const shippingAddr   = order?.shippingAddress ?? ''
  const paymentRef     = `COC DON ${orderId}`

  /* ─── Fetch đơn hàng sau khi auth xong ─── */
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login', { replace: true }); return }

    orderService.getById(orderId)
      .then(data => {
        const o = data.order || data
        setOrder(o)
        setStatus(o.status)
      })
      .catch(() => {
        // Nếu CÓ dữ liệu từ checkout state → không redirect, vẫn hiển thị trang
        // Nếu KHÔNG có gì (user vào thẳng URL) → mới redirect về /orders
        if (!initialData) {
          navigate('/orders', { replace: true })
        }
        // Khi initialData có, component dùng fallback data để hiển thị
      })
      .finally(() => setPageLoading(false))
  }, [orderId, user, authLoading])

  /* ─── Đếm ngược 24h ─── */
  useEffect(() => {
    const d = order?.orderDate
    if (!d) return
    const deadline = new Date(d).getTime() + 24 * 3600 * 1000
    const tick = () => setTimeLeft(deadline - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [order?.orderDate])

  /* ─── Đếm ngược 3h để hủy ─── */
  useEffect(() => {
    const d = order?.orderDate
    if (!d) return
    const deadline = new Date(d).getTime() + 3 * 3600 * 1000
    const tick = () => setCancelTimeLeft(deadline - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [order?.orderDate])

  /* ─── Poll trạng thái mỗi 5 giây khi chờ ─── */
  useEffect(() => {
    if (status !== 'WaitingDeposit') return
    const id = setInterval(() => {
      orderService.getById(orderId)
        .then(data => {
          const o = data.order || data
          const s = o.status
          setStatus(s)
          setOrder(o)
          if (s !== 'WaitingDeposit') clearInterval(id)
        })
        .catch(() => { /* tiếp tục poll, bỏ qua lỗi tạm thời */ })
    }, 5000)
    return () => clearInterval(id)
  }, [orderId, status])

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleCancel = async () => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return
    try {
      setCancelling(true)
      setCancelError(null)
      await orderService.cancel(orderId)
      setStatus('Cancelled')
    } catch (err) {
      setCancelError(err.message || 'Không thể hủy đơn hàng')
    } finally {
      setCancelling(false)
    }
  }

  if (authLoading || pageLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
          <p>Đang tải thông tin thanh toán...</p>
        </div>
      </main>
    )
  }

  const isExpired  = timeLeft !== null && timeLeft <= 0
  const canCancel  = status === 'WaitingDeposit' && cancelTimeLeft !== null && cancelTimeLeft > 0
  const isPaid     = ['DepositPaid', 'Processing', 'Shipping', 'Completed'].includes(status)
  const isCancelled = status === 'Cancelled'
  const statusInfo = STATUS_LABELS[status] || { text: status, color: '#555', bg: '#f5f5f5' }

  return (
    <main className={styles.page}>
      <div className={styles.container}>

        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <Link to="/orders" className={styles.backLink}>← Đơn hàng của tôi</Link>
          <span className={styles.breadSep}>/</span>
          <span>Thanh toán đơn #{orderId}</span>
        </div>

        <h1 className={styles.pageTitle}>💳 Thanh toán đặt cọc</h1>

        {/* Banner thành công */}
        {isPaid && (
          <div className={styles.successBanner}>
            <div className={styles.bannerIcon}>✓</div>
            <div className={styles.bannerText}>
              <strong>Đã nhận được tiền cọc!</strong>
              <p>Cảm ơn bạn đã tin tưởng. Đơn hàng #{orderId} đang được xử lý.</p>
            </div>
            <Link to="/orders" className={styles.bannerBtn}>Xem đơn hàng →</Link>
          </div>
        )}

        {/* Banner hủy / hết hạn */}
        {(isExpired || isCancelled) && !isPaid && (
          <div className={styles.errorBanner}>
            <div className={styles.bannerIcon}>✕</div>
            <div className={styles.bannerText}>
              <strong>{isCancelled ? 'Đơn hàng đã bị hủy' : 'Đơn hàng đã hết hạn'}</strong>
              <p>
                {isCancelled
                  ? `Đơn hàng #${orderId} đã bị hủy.`
                  : 'Quá 24 giờ chưa nhận được cọc, đơn hàng đã tự động hủy.'
                }
              </p>
            </div>
            <Link to="/products" className={styles.bannerBtn}>Mua tiếp →</Link>
          </div>
        )}

        {cancelError && <div className={styles.errorAlert}>{cancelError}</div>}

        <div className={styles.layout}>

          {/* ═══ CỘT TRÁI: QR & Số tiền ═══ */}
          <div className={styles.qrCard}>

            {/* Header ngân hàng */}
            <div className={styles.qrCardHeader}>
              <div className={styles.bankBadge}>MB</div>
              <div>
                <div className={styles.bankName}>MBBank</div>
                <div className={styles.bankSub}>Ngân hàng Quân đội</div>
              </div>
            </div>

            {/* ẢNH QR CỦA SHOP */}
            <div className={styles.qrWrapper}>
              <img
                src="/qr-ngan-hang.jpg"
                alt="Mã QR chuyển khoản ngân hàng"
                className={styles.qrImage}
              />
            </div>

            <p className={styles.qrInstruction}>
              📱 Mở app ngân hàng → Quét QR → Nhập <strong>số tiền</strong> &amp; <strong>nội dung</strong> bên dưới
            </p>

            {/* Số tiền nổi bật */}
            <div className={styles.amountBig}>
              <div className={styles.amountLabel}>💰 Số tiền cần chuyển</div>
              <div className={styles.amountNum}>{formatPrice(depositAmount)}</div>
              <div className={styles.amountSub}>Đặt cọc 50% · Còn lại thanh toán khi nhận</div>
            </div>

            {/* Nội dung chuyển khoản nổi bật */}
            <div className={styles.refBox}>
              <div className={styles.refLabel}>📝 Nội dung chuyển khoản</div>
              <div className={styles.refValue}>{paymentRef}</div>
              <button
                className={`${styles.copyBtn} ${copied === 'ref' ? styles.copied : ''}`}
                onClick={() => copy(paymentRef, 'ref')}
              >
                {copied === 'ref' ? '✓ Đã copy' : '📋 Copy nội dung'}
              </button>
            </div>

          </div>

          {/* ═══ CỘT PHẢI: Thông tin & Trạng thái ═══ */}
          <div className={styles.infoCard}>

            {/* Trạng thái đơn */}
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>Trạng thái đơn hàng:</span>
              <span className={styles.statusBadge} style={{ color: statusInfo.color, background: statusInfo.bg }}>
                {statusInfo.text}
              </span>
            </div>

            {/* Thông tin chuyển khoản */}
            <div className={styles.infoSection}>
              <div className={styles.infoSectionTitle}>🏦 Thông tin tài khoản nhận tiền</div>

              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Ngân hàng</span>
                <span className={styles.infoVal}>{BANK_NAME}</span>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Số tài khoản</span>
                <div className={styles.copyGroup}>
                  <span className={styles.infoVal}>{ACCOUNT_NO}</span>
                  <button
                    className={`${styles.copyBtn} ${copied === 'acct' ? styles.copied : ''}`}
                    onClick={() => copy(ACCOUNT_NO, 'acct')}
                  >
                    {copied === 'acct' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Chủ tài khoản</span>
                <span className={styles.infoVal}>{ACCOUNT_NAME}</span>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Số tiền</span>
                <span className={`${styles.infoVal} ${styles.highlight}`}>{formatPrice(depositAmount)}</span>
              </div>

              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Nội dung CK</span>
                <div className={styles.copyGroup}>
                  <span className={`${styles.infoVal} ${styles.refVal}`}>{paymentRef}</span>
                  <button
                    className={`${styles.copyBtn} ${copied === 'ref2' ? styles.copied : ''}`}
                    onClick={() => copy(paymentRef, 'ref2')}
                  >
                    {copied === 'ref2' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Tóm tắt đơn hàng */}
            <div className={styles.infoSection}>
              <div className={styles.infoSectionTitle}>🧾 Tóm tắt đơn hàng #{orderId}</div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Tổng đơn hàng</span>
                <span className={styles.infoVal}>{formatPrice(totalAmount)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Đặt cọc ngay (50%)</span>
                <span className={`${styles.infoVal} ${styles.highlight}`}>{formatPrice(depositAmount)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoKey}>Còn lại khi nhận hàng</span>
                <span className={styles.infoVal}>{formatPrice(totalAmount - depositAmount)}</span>
              </div>
            </div>

            {/* Thông tin giao hàng */}
            {(customerName || customerPhone || shippingAddr) && (
              <div className={styles.infoSection}>
                <div className={styles.infoSectionTitle}>📦 Thông tin giao hàng</div>
                {customerName && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>Người nhận</span>
                    <span className={styles.infoVal}>{customerName}</span>
                  </div>
                )}
                {customerPhone && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>Số điện thoại</span>
                    <span className={styles.infoVal}>{customerPhone}</span>
                  </div>
                )}
                {shippingAddr && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoKey}>Địa chỉ</span>
                    <span className={styles.infoVal} style={{ textAlign: 'right', maxWidth: '60%' }}>{shippingAddr}</span>
                  </div>
                )}
              </div>
            )}

            {/* Đếm ngược 24h */}
            {!isPaid && !isCancelled && (
              <div className={`${styles.countdown} ${isExpired ? styles.countdownExpired : timeLeft !== null && timeLeft < 3600000 ? styles.countdownUrgent : ''}`}>
                <div className={styles.countdownLabel}>
                  {isExpired ? '⛔ Đã hết thời gian đặt cọc' : '⏳ Thời gian còn lại để đặt cọc'}
                </div>
                <div className={styles.countdownTimer}>{formatCountdown(timeLeft)}</div>
                <div className={styles.countdownNote}>
                  {isExpired
                    ? 'Đơn hàng sẽ bị hủy tự động'
                    : 'Đơn hàng tự hủy sau 24 giờ nếu chưa nhận cọc'
                  }
                </div>
              </div>
            )}

            {/* Đang chờ xác nhận */}
            {status === 'WaitingDeposit' && !isExpired && (
              <div className={styles.pollingRow}>
                <div className={styles.pulsingDot} />
                <span>Đang chờ admin xác nhận thanh toán... (tự động cập nhật)</span>
              </div>
            )}

            {/* Hủy đơn trong 3h */}
            {canCancel && (
              <div className={styles.cancelSection}>
                <div className={styles.cancelInfo}>
                  <span>Có thể hủy trong: </span>
                  <strong className={cancelTimeLeft < 900000 ? styles.urgentText : ''}>
                    {formatCountdown(cancelTimeLeft)}
                  </strong>
                </div>
                <button className={styles.cancelBtn} onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? 'Đang hủy...' : 'Hủy đơn hàng'}
                </button>
              </div>
            )}

            {status === 'WaitingDeposit' && !canCancel && cancelTimeLeft !== null && cancelTimeLeft <= 0 && (
              <div className={styles.cancelExpired}>Đã quá 3 giờ — không thể hủy đơn hàng</div>
            )}

            {/* Lưu ý */}
            <div className={styles.noteBox}>
              <div className={styles.noteTitle}>⚠️ Lưu ý quan trọng</div>
              <ul className={styles.noteList}>
                <li>Nhập <strong>đúng nội dung</strong>: <code>{paymentRef}</code></li>
                <li>Số tiền phải đúng: <strong>{formatPrice(depositAmount)}</strong></li>
                <li>Admin xác nhận trong vài phút sau khi nhận chuyển khoản</li>
                <li>Phần còn lại <strong>{formatPrice(totalAmount - depositAmount)}</strong> thanh toán khi nhận hàng</li>
                <li>Chỉ hủy được trong <strong>3 giờ đầu</strong> sau khi đặt</li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </main>
  )
}