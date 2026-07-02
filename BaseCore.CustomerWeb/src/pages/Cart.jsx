import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { cartService } from '../services/cart/cartService'
import styles from './Cart.module.css'

function formatPrice(n) { return n.toLocaleString('vi-VN') + 'đ' }

export default function Cart() {
  const { cart, remove, setQty, total, clear, isLoading, error } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutData, setCheckoutData] = useState({
    customerName: '',
    customerPhone: '',
    province: '',
    ward: '',
    streetAddress: '',
  })
  const [provinces, setProvinces] = useState([])
  const [wards, setWards] = useState([])
  const [loadingWards, setLoadingWards] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  const [stockNotice, setStockNotice] = useState('')
  const [shippingMethod, setShippingMethod] = useState('Standard')
  const [compatWarnings, setCompatWarnings] = useState([])

  useEffect(() => {
    if (!cart || cart.length === 0) {
      setCompatWarnings([])
      return
    }

    const warnings = []
    const liveItems = cart.filter(i => i.phMin != null || i.phMax != null || i.tempMin != null || i.tempMax != null)

    if (liveItems.length > 1) {
      // 1. Kiểm tra pH trùng khớp
      for (let i = 0; i < liveItems.length; i++) {
        for (let j = i + 1; j < liveItems.length; j++) {
          const a = liveItems[i]
          const b = liveItems[j]
          if (a.phMin != null && a.phMax != null && b.phMin != null && b.phMax != null) {
            const overlap = !(a.phMin > b.phMax || b.phMin > a.phMax)
            if (!overlap) {
              warnings.push({
                type: 'danger',
                text: `🧪 Không tương thích pH: "${a.name}" (pH ${a.phMin} - ${a.phMax}) và "${b.name}" (pH ${b.phMin} - ${b.phMax}) cần môi trường pH khác nhau. Nuôi chung có thể gây sốc nước.`
              })
            }
          }
        }
      }

      // 2. Kiểm tra Nhiệt độ trùng khớp
      for (let i = 0; i < liveItems.length; i++) {
        for (let j = i + 1; j < liveItems.length; j++) {
          const a = liveItems[i]
          const b = liveItems[j]
          if (a.tempMin != null && a.tempMax != null && b.tempMin != null && b.tempMax != null) {
            const overlap = !(a.tempMin > b.tempMax || b.tempMin > a.tempMax)
            if (!overlap) {
              warnings.push({
                type: 'danger',
                text: `🌡️ Không tương thích nhiệt độ: "${a.name}" (${a.tempMin}°C - ${a.tempMax}°C) và "${b.name}" (${b.tempMin}°C - ${b.tempMax}°C) cần nhiệt độ nước khác nhau.`
              })
            }
          }
        }
      }

      // 3. Kiểm tra Tính khí (Hiền / Dữ)
      const aggressiveKeywords = ['ali', 'chọi', 'betta', 'la hán', 'cá rồng', 'săn mồi', 'tai tượng', 'la han', 'choi', 'ca rong', 'aggressive', 'dữ', 'cắn đuôi']
      const peacefulKeywords = ['neon', 'guppy', 'bảy màu', 'bay mau', 'molly', 'mún', 'mun', 'sọc ngựa', 'soc ngua', 'sặc gấm', 'sac gam', 'tân vân', 'tan van', 'peaceful', 'hiền', 'hien', 'chuột', 'dọn bể']

      for (let i = 0; i < liveItems.length; i++) {
        for (let j = i + 1; j < liveItems.length; j++) {
          const a = liveItems[i]
          const b = liveItems[j]
          const aNameLower = a.name.toLowerCase()
          const bNameLower = b.name.toLowerCase()
          const aCompatLower = (a.compatibility || '').toLowerCase()
          const bCompatLower = (b.compatibility || '').toLowerCase()

          const aIsAggressive = aggressiveKeywords.some(k => aNameLower.includes(k) || aCompatLower.includes(k))
          const bIsAggressive = aggressiveKeywords.some(k => bNameLower.includes(k) || bCompatLower.includes(k))
          const aIsPeaceful = peacefulKeywords.some(k => aNameLower.includes(k) || aCompatLower.includes(k))
          const bIsPeaceful = peacefulKeywords.some(k => bNameLower.includes(k) || bCompatLower.includes(k))

          if ((aIsAggressive && bIsPeaceful) || (bIsAggressive && aIsPeaceful)) {
            const aggName = aIsAggressive ? a.name : b.name
            const peaceName = aIsPeaceful ? a.name : b.name
            warnings.push({
              type: 'warning',
              text: `⚠️ Cảnh báo tính khí: "${aggName}" có đặc tính hung dữ/bắt nạt, có thể tấn công "${peaceName}" hiền lành.`
            })
          }
        }
      }
    }

    setCompatWarnings(warnings)
  }, [cart])

  useEffect(() => {
    if (user) {
      setCheckoutData(prev => ({
        ...prev,
        customerName: user.name || user.username || '',
        customerPhone: user.phone || ''
      }))
    }
  }, [user])

  useEffect(() => {
    fetch('https://provinces.open-api.vn/api/p/')
      .then(r => r.json())
      .then(data => setProvinces(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (error) setStockNotice(error)
  }, [error])

  const handleClearName = () => {
    setCheckoutData(prev => ({ ...prev, customerName: '' }))
  }

  const handleProvinceChange = async (value) => {
    const selectedProv = provinces.find(p => p.name === value)
    setCheckoutData(prev => ({ ...prev, province: value, ward: '' }))
    setWards([])
    if (!selectedProv) return
    setLoadingWards(true)
    try {
      const resp = await fetch(`https://provinces.open-api.vn/api/p/${selectedProv.code}?depth=3`)
      const data = await resp.json()
      const allWards = data.districts?.flatMap(d => d.wards || []) || []
      setWards(allWards)
    } catch {
      setWards([])
    } finally {
      setLoadingWards(false)
    }
  }

  const hasStockLimit = (item) =>
    item.availableStock !== null && item.availableStock !== undefined

  const getStockUnit = (item) => {
    if (item.selectedGender === 'Cặp') return 'cặp'
    if (item.selectedGender) return `con ${item.selectedGender.toLowerCase()}`
    return 'sản phẩm'
  }

  const getStockLimitMessage = (item) => {
    const unit = getStockUnit(item)
    return `Chỉ còn ${item.availableStock} ${unit} trong kho. Bạn không thể tăng thêm số lượng cho sản phẩm này.`
  }

  const increaseQuantity = (item) => {
    if (hasStockLimit(item) && item.quantity >= item.availableStock) {
      setStockNotice(getStockLimitMessage(item))
      return
    }
    setStockNotice('')
    setQty(item.id, item.quantity + 1)
  }

  const shipping = shippingMethod === 'Express' ? 65000 : (total >= 500000 ? 0 : 35000)
  const packagingFee = 0
  const grandTotal = total + shipping

  const handleCheckoutChange = (field, value) => {
    setCheckoutData(prev => ({ ...prev, [field]: value }))
  }

  const openCheckoutModal = () => {
    setCheckoutError(null)
    setShowCheckout(true)
  }

  const closeCheckoutModal = () => {
    setShowCheckout(false)
    setCheckoutError(null)
  }

  const handleCheckout = async () => {
    if (!checkoutData.customerName.trim() || !checkoutData.customerPhone.trim() ||
        !checkoutData.province || !checkoutData.ward || !checkoutData.streetAddress.trim()) {
      setCheckoutError('Vui lòng điền đầy đủ thông tin giao hàng')
      return
    }

    try {
      setCheckoutLoading(true)
      setCheckoutError(null)
      const fullAddress = `${checkoutData.streetAddress}, ${checkoutData.ward}, ${checkoutData.province}`
      const result = await cartService.checkout(
        fullAddress,
        shippingMethod,
        'COD',
        checkoutData.customerName,
        checkoutData.customerPhone,
        shipping,
        packagingFee
      )
      await clear()
      closeCheckoutModal()
      navigate(`/payment/${result.orderId}`, { state: { order: result } })
    } catch (err) {
      setCheckoutError(err.message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  if (isLoading && cart.length === 0) return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.empty}>
          <h2>Đang tải giỏ hàng...</h2>
        </div>
      </div>
    </main>
  )

  if (error && cart.length === 0) return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⚠️</div>
          <h2>Lỗi</h2>
          <p>{error}</p>
          <Link to="/products" className={styles.shopBtn}>Quay lại cửa hàng →</Link>
        </div>
      </div>
    </main>
  )

  if (cart.length === 0) return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🛒</div>
          <h2>Giỏ hàng trống</h2>
          <p>Bạn chưa thêm sản phẩm nào. Hãy khám phá cửa hàng của chúng tôi!</p>
          <Link to="/products" className={styles.shopBtn}>Khám phá sản phẩm →</Link>
        </div>
      </div>
    </main>
  )

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Giỏ hàng của bạn</h1>
          <span>{cart.reduce((s, i) => s + i.quantity, 0)} sản phẩm</span>
        </div>

        {stockNotice && (
          <div className={styles.stockNotice}>
            {stockNotice}
          </div>
        )}

        {/* Bộ tự động kiểm tra tương thích nước */}
        {cart.length > 0 && (
          <div className={styles.compatContainer}>
            <div className={styles.compatHeader}>
              <span style={{ fontSize: '1.25rem' }}>🌊</span>
              <h3>BỘ KIỂM TRA ĐỘ TƯƠNG THÍCH MÔI TRƯỜNG & TÍNH KHÍ</h3>
            </div>
            <div className={styles.compatList}>
              {compatWarnings.length > 0 ? (
                compatWarnings.map((warn, index) => (
                  <div
                    key={index}
                    className={`${styles.compatItem} ${
                      warn.type === 'danger' ? styles.compatDanger : styles.compatWarning
                    }`}
                  >
                    <div>{warn.text}</div>
                  </div>
                ))
              ) : (
                <div className={`${styles.compatItem} ${styles.compatSuccess}`}>
                  <span>✓</span> Các sinh vật trong giỏ hàng hoàn toàn tương thích với nhau về thông số nước (pH, nhiệt độ) và tính khí! Bạn có thể nuôi chung chúng cùng một bể.
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.layout}>
          {/* Cart items */}
          <div className={styles.items}>
            <div className={styles.itemsHead}>
              <span>Sản phẩm</span>
              <span>Đơn giá</span>
              <span>Số lượng</span>
              <span>Thành tiền</span>
              <span></span>
            </div>

            {cart.map(item => (
              <div key={`${item.productId}-${item.selectedGender ?? ''}`} className={styles.item}>
                <div className={styles.itemProduct}>
                  <Link to={`/product/${item.productId}`}>
                    <img src={item.image} alt={item.name} />
                  </Link>
                  <div>
                    <Link to={`/product/${item.productId}`} className={styles.itemName}>{item.name}</Link>
                    {item.selectedGender && (
                      <span style={{
                        display: 'inline-block',
                        marginTop: '0.25rem',
                        padding: '0.15rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: item.selectedGender === 'Đực' ? '#e3f2fd' : item.selectedGender === 'Cái' ? '#fce4ec' : '#e8f5e9',
                        color: item.selectedGender === 'Đực' ? '#1565c0' : item.selectedGender === 'Cái' ? '#c62828' : '#2e7d32',
                      }}>
                        {item.selectedGender === 'Cặp' ? 'Cặp đôi' : `Con ${item.selectedGender.toLowerCase()}`}
                      </span>
                    )}
                  </div>
                </div>

                <span className={styles.itemPrice}>
                  {formatPrice(item.price)}
                  {item.selectedGender === 'Cặp' && (
                    <small style={{ display: 'block', color: '#666', fontSize: '0.7rem', fontWeight: 400 }}>
                      (2 con)
                    </small>
                  )}
                </span>

                <div className={styles.quantityCell}>
                  <div className={styles.qtyControl}>
                    <button onClick={() => item.quantity === 1 ? remove(item.id) : setQty(item.id, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => increaseQuantity(item)}
                      className={hasStockLimit(item) && item.quantity >= item.availableStock ? styles.limitBtn : ''}
                      title={hasStockLimit(item) ? `Tối đa ${item.availableStock} ${getStockUnit(item)}` : 'Tăng số lượng'}
                    >
                      +
                    </button>
                  </div>
                  {hasStockLimit(item) && (
                    <small className={styles.stockHint}>
                      Tối đa {item.availableStock} {getStockUnit(item)}
                    </small>
                  )}
                </div>

                <span className={styles.itemTotal}>{formatPrice(item.price * item.quantity)}</span>

                <button className={styles.removeBtn} onClick={() => remove(item.id)} title="Xóa">✕</button>
              </div>
            ))}

            <div className={styles.itemsFooter}>
              <button className={styles.clearBtn} onClick={clear}>🗑 Xóa tất cả</button>
              <Link to="/products" className={styles.continueBtn}>← Tiếp tục mua</Link>
            </div>
          </div>

          {/* Summary */}
          <div className={styles.summary}>
            <h2>Tóm tắt đơn hàng</h2>

            <div className={styles.summaryRow}>
              <span>Tạm tính ({cart.reduce((s, i) => s + i.quantity, 0)} sp)</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Phí vận chuyển{shippingMethod === 'Express' ? ' (Nhanh)' : ''}</span>
              <span className={shipping === 0 ? styles.free : ''}>
                {shipping === 0 ? 'Miễn phí' : formatPrice(shipping)}
              </span>
            </div>
            {shippingMethod === 'Standard' && total < 500000 && (
              <p className={styles.shippingNote}>
                Thêm <strong>{formatPrice(500000 - total)}</strong> để được miễn phí vận chuyển
              </p>
            )}
            <div className={styles.divider} />
            <div className={`${styles.summaryRow} ${styles.totalRow}`}>
              <span>Tổng cộng</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>

            <button className={styles.checkoutBtn} onClick={openCheckoutModal}>
              Tiến hành thanh toán →
            </button>

            <div className={styles.paymentIcons}>
              <span>💳</span><span>🏦</span><span>📱</span>
              <small>Thanh toán an toàn</small>
            </div>
          </div>
        </div>

        {/* Checkout Modal */}
        {showCheckout && (
          <div className={styles.modal} onClick={closeCheckoutModal}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

              <div className={styles.modalHeader}>
                <h2>📋 Thông tin đặt hàng</h2>
                <button className={styles.closeBtn} onClick={closeCheckoutModal}>✕</button>
              </div>

                  <div className={styles.formGroup}>
                    <label>Tên khách hàng *</label>
                    <div className={styles.inputGroup}>
                      <input
                        type="text"
                        placeholder="Nhập tên của bạn"
                        value={checkoutData.customerName}
                        onChange={e => handleCheckoutChange('customerName', e.target.value)}
                      />
                      {checkoutData.customerName && (
                        <button 
                          type="button"
                          className={styles.clearBtn}
                          onClick={handleClearName}
                          title="Xóa tên"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Số điện thoại *</label>
                    <input
                      type="tel"
                      placeholder="Nhập số điện thoại"
                      value={checkoutData.customerPhone}
                      onChange={e => handleCheckoutChange('customerPhone', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Tỉnh / Thành phố *</label>
                    <select
                      value={checkoutData.province}
                      onChange={e => handleProvinceChange(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: '0.95rem', background: '#fff' }}
                    >
                      <option value="">-- Chọn Tỉnh / Thành phố --</option>
                      {provinces.map(p => (
                        <option key={p.code} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Xã / Phường *</label>
                    <select
                      value={checkoutData.ward}
                      onChange={e => handleCheckoutChange('ward', e.target.value)}
                      disabled={!checkoutData.province || loadingWards}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: '0.95rem', background: checkoutData.province && !loadingWards ? '#fff' : '#f5f5f5' }}
                    >
                      <option value="">
                        {loadingWards ? '-- Đang tải xã/phường...' : '-- Chọn Xã / Phường --'}
                      </option>
                      {wards.map(w => (
                        <option key={w.code} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Số nhà, tên đường *</label>
                    <input
                      type="text"
                      placeholder="VD: 123 Nguyễn Huệ"
                      value={checkoutData.streetAddress}
                      onChange={e => handleCheckoutChange('streetAddress', e.target.value)}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Phương thức vận chuyển *</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {[
                        { key: 'Standard', label: 'Tiêu chuẩn', desc: `${total >= 500000 ? 'Miễn phí (đơn ≥ 500K)' : '35.000đ'}`, icon: '📦' },
                        { key: 'Express', label: 'Nhanh (Express)', desc: '65.000đ', icon: '⚡' },
                      ].map(opt => (
                        <label key={opt.key} style={{
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          padding: '0.6rem 0.75rem', borderRadius: 8,
                          border: `2px solid ${shippingMethod === opt.key ? '#1976d2' : '#e0e0e0'}`,
                          background: shippingMethod === opt.key ? '#e3f2fd' : '#fff',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}>
                          <input type="radio" name="shippingMethod" value={opt.key}
                            checked={shippingMethod === opt.key}
                            onChange={() => setShippingMethod(opt.key)}
                            style={{ accentColor: '#1976d2' }} />
                          <span style={{ fontSize: '1.1rem' }}>{opt.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{opt.label}</div>
                            <div style={{ color: '#666', fontSize: '0.8rem' }}>{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 6, padding: '0.7rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    <strong style={{ color: '#e65100' }}>⚠️ Lưu ý đặt cọc:</strong> Sau khi đặt hàng, bạn cần chuyển khoản <strong style={{ color: '#e65100' }}>{formatPrice(Math.round(grandTotal * 0.5))}</strong> (50% giá trị đơn) để xác nhận. Đơn hàng sẽ bị huỷ sau 24 giờ nếu chưa nhận được cọc.
                  </div>

                  {checkoutError && (
                    <div className={styles.errorMsg}>{checkoutError}</div>
                  )}

                  <div className={styles.modalFooter}>
                    <button className={styles.cancelBtn} onClick={closeCheckoutModal}>Hủy</button>
                    <button
                      className={styles.submitBtn}
                      onClick={handleCheckout}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? 'Đang xử lý...' : 'Xác nhận đặt hàng →'}
                    </button>
                  </div>

            </div>
          </div>
        )}
      </div>
    </main>
  )
}
