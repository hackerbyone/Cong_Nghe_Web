import { useState } from 'react'
import styles from './GenderSelectorModal.module.css'

export default function GenderSelectorModal({ 
  product, 
  isOpen, 
  onClose, 
  onConfirm 
}) {
  const [selectedGender, setSelectedGender] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState('')

  // Xác định các tùy chọn giới tính sẵn có
  const genderOptions = []
  if (product?.maleStock > 0) {
    genderOptions.push({ 
      value: 'Đực', 
      label: 'Con đực', 
      stock: product.maleStock,
      icon: '🐟',
      color: '#1565c0'
    })
  }
  if (product?.femaleStock > 0) {
    genderOptions.push({ 
      value: 'Cái', 
      label: 'Con cái', 
      stock: product.femaleStock,
      icon: '🐠',
      color: '#c62828'
    })
  }
  if (product?.maleStock > 0 && product?.femaleStock > 0) {
    genderOptions.push({ 
      value: 'Cặp', 
      label: 'Cặp đôi (1 đực + 1 cái)', 
      stock: Math.min(product.maleStock, product.femaleStock),
      icon: '💑',
      color: '#2e7d32'
    })
  }

  const handleConfirm = () => {
    if (!selectedGender) {
      setError('Vui lòng chọn giới tính')
      return
    }
    setError('')
    onConfirm(selectedGender, quantity)
    resetForm()
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setSelectedGender(null)
    setQuantity(1)
    setError('')
  }

  if (!isOpen || !product) return null

  const getSelectedGenderStock = () => {
    if (!selectedGender) return null
    return genderOptions.find(o => o.value === selectedGender)?.stock ?? 0
  }

  const selectedStock = getSelectedGenderStock()

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>🐟 Chọn giới tính sản phẩm</h2>
          <button className={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.body}>
          {/* Product preview */}
          <div className={styles.preview}>
            <img 
              src={product.imageUrl || product.image || 'https://via.placeholder.com/150'} 
              alt={product.name} 
            />
            <div className={styles.previewInfo}>
              <h3>{product.name}</h3>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>
                Chọn giới tính để tiếp tục thêm vào giỏ
              </p>
            </div>
          </div>

          {/* Gender options */}
          <div className={styles.genderOptions}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#333' }}>
              Chọn giới tính *
            </label>
            <div className={styles.optionsGrid}>
              {genderOptions.map(option => (
                <button
                  key={option.value}
                  className={`${styles.optionBtn} ${selectedGender === option.value ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedGender(option.value)
                    setError('')
                  }}
                  style={selectedGender === option.value ? {
                    borderColor: option.color,
                    backgroundColor: option.color + '15',
                  } : {}}
                  title={`${option.label} - Còn ${option.stock} cái`}
                >
                  <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.3rem' }}>
                    {option.icon}
                  </span>
                  <span style={{ fontWeight: '600', display: 'block', marginBottom: '0.15rem' }}>
                    {option.label}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>
                    Còn: {option.stock} cái
                  </span>
                </button>
              ))}
            </div>
            {error && <div className={styles.error}>{error}</div>}
          </div>

          {/* Quantity selector */}
          {selectedGender && (
            <div className={styles.quantitySection}>
              <label>Số lượng *</label>
              <div className={styles.quantityControl}>
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max={selectedStock}
                />
                <button 
                  onClick={() => setQuantity(Math.min(selectedStock, quantity + 1))}
                  disabled={quantity >= selectedStock}
                >
                  +
                </button>
              </div>
              <small style={{ color: '#666' }}>
                Tối đa: {selectedStock} {selectedGender === 'Cặp' ? 'cặp' : 'con'}
              </small>
            </div>
          )}

          {/* Price info */}
          <div className={styles.priceInfo}>
            <span>Giá:</span>
            <strong>
              {product.price?.toLocaleString('vi-VN') || '0'}đ
              {selectedGender === 'Cặp' && <small> (2 con)</small>}
            </strong>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleClose}>
            Hủy
          </button>
          <button 
            className={styles.confirmBtn} 
            onClick={handleConfirm}
            disabled={!selectedGender}
          >
            ✓ Thêm vào giỏ ({quantity})
          </button>
        </div>
      </div>
    </div>
  )
}
