import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import styles from './ProductCard.module.css'

function formatPrice(n) {
  return (n || 0).toLocaleString('vi-VN') + 'đ'
}

function GenderPopup({ product, onConfirm, onClose }) {
  const options = []
  if (product.maleStock > 0)
    options.push({ value: 'Đực', label: '♂ Con đực', stock: product.maleStock, color: '#1565c0', bg: '#e3f2fd' })
  if (product.femaleStock > 0)
    options.push({ value: 'Cái', label: '♀ Con cái', stock: product.femaleStock, color: '#c62828', bg: '#fce4ec' })
  if (product.maleStock > 0 && product.femaleStock > 0)
    options.push({ value: 'Cặp', label: '⚤ Cặp đôi', stock: Math.min(product.maleStock, product.femaleStock), color: '#2e7d32', bg: '#e8f5e9' })

  const [selected, setSelected] = useState(null)
  const [qty, setQty] = useState(1)

  const maxQty = selected ? (options.find(o => o.value === selected)?.stock ?? 1) : 1

  const handleSelect = (val) => {
    setSelected(val)
    setQty(1) // reset số lượng khi đổi giới tính
  }

  const handleQty = (delta) => {
    setQty(q => Math.min(maxQty, Math.max(1, q + delta)))
  }

  const totalPrice = product.price * qty

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Thêm vào giỏ hàng</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#888' }}>{product.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#aaa', lineHeight: 1, padding: '0 0.2rem' }}>×</button>
        </div>

        {/* Giới tính */}
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#444' }}>Chọn giới tính:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1rem' }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              style={{
                padding: '0.6rem 1rem', borderRadius: 10, border: '2px solid',
                borderColor: selected === opt.value ? opt.color : '#e0e0e0',
                background: selected === opt.value ? opt.bg : '#fafafa',
                color: selected === opt.value ? opt.color : '#333',
                cursor: 'pointer', textAlign: 'left',
                fontWeight: selected === opt.value ? 700 : 400,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'all 0.15s',
              }}
            >
              <span>{opt.label}</span>
              <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>Còn {opt.stock}</span>
            </button>
          ))}
        </div>

        {/* Số lượng */}
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#444' }}>Số lượng:</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => handleQty(-1)}
              disabled={qty <= 1}
              style={{
                width: 38, height: 38, border: 'none', background: qty <= 1 ? '#f5f5f5' : '#fff',
                cursor: qty <= 1 ? 'not-allowed' : 'pointer', fontSize: '1.2rem',
                color: qty <= 1 ? '#ccc' : '#333', fontWeight: 700,
              }}
            >−</button>
            <span style={{ minWidth: 36, textAlign: 'center', fontWeight: 700, fontSize: '1rem' }}>{qty}</span>
            <button
              onClick={() => handleQty(1)}
              disabled={!selected || qty >= maxQty}
              style={{
                width: 38, height: 38, border: 'none',
                background: (!selected || qty >= maxQty) ? '#f5f5f5' : '#fff',
                cursor: (!selected || qty >= maxQty) ? 'not-allowed' : 'pointer',
                fontSize: '1.2rem', color: (!selected || qty >= maxQty) ? '#ccc' : '#333', fontWeight: 700,
              }}
            >+</button>
          </div>
          {selected && (
            <span style={{ fontSize: '0.8rem', color: '#888' }}>
              Tối đa {maxQty} {selected === 'Cặp' ? 'cặp' : 'con'}
            </span>
          )}
        </div>

        {/* Tổng tiền */}
        {selected && (
          <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>Tạm tính:</span>
            <strong style={{ fontSize: '1.05rem', color: '#e65100' }}>{formatPrice(totalPrice)}</strong>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '0.65rem', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 500 }}
          >Hủy</button>
          <button
            onClick={() => selected && onConfirm(selected, qty)}
            disabled={!selected}
            style={{
              flex: 2, padding: '0.65rem', borderRadius: 8, border: 'none',
              background: selected ? 'var(--teal, #2a9d8f)' : '#ccc',
              color: '#fff', cursor: selected ? 'pointer' : 'not-allowed',
              fontWeight: 600, fontSize: '0.95rem',
            }}
          >
            🛒 Thêm {qty > 1 ? `${qty} ` : ''}vào giỏ
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProductCard({ product }) {
  const { add } = useCart()
  const [showPopup, setShowPopup] = useState(false)
  const [added, setAdded] = useState(false)

  const discount = product.oldPrice
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : null

  const isGenderProduct = product.maleStock > 0 || product.femaleStock > 0

  const handleAddClick = () => {
    if (isGenderProduct) {
      setShowPopup(true)
    } else {
      doAdd(null, 1)
    }
  }

  const doAdd = async (gender, qty = 1) => {
    setShowPopup(false)
    for (let i = 0; i < qty; i++) {
      await add(product, gender)
    }
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <>
      <div className={styles.card}>
        <Link to={`/product/${product.id}`} className={styles.imageWrap}>
          <img src={product.imageUrl || product.image || 'https://via.placeholder.com/300x300'} alt={product.name} loading="lazy" />
          {discount && <span className={styles.discount}>-{discount}%</span>}
        </Link>
        <div className={styles.body}>
          <Link to={`/product/${product.id}`}>
            <h3 className={styles.name}>{product.name}</h3>
          </Link>
          <div className={styles.rating}>
            {(() => {
              const r = Math.max(0, Math.min(5, Math.round(product.rating || 0)))
              return (
                <>
                  <span style={{ color: '#f59e0b' }}>{'★'.repeat(r)}</span>
                  <span style={{ color: '#d1d5db' }}>{'☆'.repeat(5 - r)}</span>
                </>
              )
            })()}
            <span>
              {Number(product.rating || 0).toFixed(1)}
              {' '}
              <span style={{ color: '#9ca3af' }}>({product.reviews || 0})</span>
            </span>
          </div>
          <div className={styles.priceRow}>
            <span className={styles.price}>{formatPrice(product.price)}</span>
            {product.oldPrice && <span className={styles.oldPrice}>{formatPrice(product.oldPrice)}</span>}
          </div>
          <button
            className={styles.addBtn}
            onClick={handleAddClick}
            style={added ? { background: '#2e7d32' } : {}}
          >
            {added ? '✓ Đã thêm' : isGenderProduct ? '🐟 Chọn & Thêm' : '+ Thêm vào giỏ'}
          </button>
        </div>
      </div>

      {showPopup && (
        <GenderPopup
          product={product}
          onConfirm={doAdd}
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  )
}