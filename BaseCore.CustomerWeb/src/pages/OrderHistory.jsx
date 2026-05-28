import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { orderService } from '../services/order/orderService';
import { reviewService } from '../services/review/reviewService';
import styles from './OrderHistory.module.css';

const REVIEWABLE_STATUSES = ['Completed'];

function formatPrice(n) {
  return (n ?? 0).toLocaleString('vi-VN') + 'đ';
}

export default function OrderHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState(new Set());

  const [reviewedOrderIds, setReviewedOrderIds] = useState(new Set());
  const [reviewOrderId, setReviewOrderId] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await orderService.getAll();
      setOrders(Array.isArray(data) ? data : data.items || []);
    } catch (error) {
      console.error('Lỗi tải đơn hàng:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewedOrders = async () => {
    try {
      const ids = await reviewService.getMyReviewedOrders();
      setReviewedOrderIds(new Set(ids));
    } catch { }
  };

  useEffect(() => {
    if (user) { fetchOrders(); fetchReviewedOrders(); }
  }, [user]);

  const toggleExpand = (orderId) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) {
      try {
        await orderService.cancel(orderId);
        alert('Hủy đơn thành công!');
        fetchOrders();
      } catch (error) {
        alert(error.message || 'Không thể hủy đơn hàng');
      }
    }
  };

  const openReviewModal = (orderId) => {
    setReviewOrderId(orderId);
    setReviewForm({ rating: 5, comment: '' });
    setReviewError('');
    setShowWarning(false);
    setReviewSuccess(false);
    setShowReviewModal(true);
  };

  const closeReviewModal = () => { setShowReviewModal(false); setReviewOrderId(null); };

  const handleReviewNext = () => {
    if (!reviewForm.comment.trim()) { setReviewError('Vui lòng nhập nhận xét của bạn'); return; }
    setReviewError('');
    setShowWarning(true);
  };

  const handleReviewSubmit = async () => {
    setReviewLoading(true);
    setReviewError('');
    try {
      await reviewService.create({ orderId: reviewOrderId, rating: reviewForm.rating, comment: reviewForm.comment });
      setReviewSuccess(true);
      setShowWarning(false);
      setReviewedOrderIds(prev => new Set([...prev, reviewOrderId]));
    } catch (err) {
      setReviewError(err.message || 'Gửi đánh giá thất bại');
      setShowWarning(false);
    } finally {
      setReviewLoading(false);
    }
  };

  const renderStatus = (status) => {
    const map = {
      WaitingDeposit: { cls: styles.statusWaiting,   label: '⏳ Chờ đặt cọc' },
      DepositPaid:    { cls: styles.statusDeposit,   label: '💳 Đã đặt cọc' },
      Processing:     { cls: styles.statusPending,   label: '⚙️ Đang xử lý' },
      Shipping:       { cls: styles.statusShipping,  label: '🚚 Đang giao hàng' },
      Completed:      { cls: styles.statusCompleted, label: '✅ Hoàn thành' },
      Cancelled:      { cls: styles.statusCancelled, label: '❌ Đã hủy' },
      Pending:        { cls: styles.statusPending,   label: '⏳ Đang chờ duyệt' },
    };
    const s = map[status] || { cls: '', label: status };
    return <span className={`${styles.statusBadge} ${s.cls}`}>{s.label}</span>;
  };

  if (!user) return <div className={styles.message}>Vui lòng đăng nhập để xem đơn hàng.</div>;
  if (loading) return <div className={styles.message}>Đang tải lịch sử đơn hàng...</div>;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Đơn hàng của tôi</h1>

      {orders.length === 0 ? (
        <p>Bạn chưa có đơn hàng nào. <Link to="/products">Đi mua cá ngay!</Link></p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>Mã Đơn</th>
                <th>Ngày đặt</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                {/* FIX 7: đổi tên cột rõ hơn */}
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const isExpanded = expandedOrders.has(order.id);
                const canReview = REVIEWABLE_STATUSES.includes(order.status) && !reviewedOrderIds.has(order.id);
                const hasReviewed = REVIEWABLE_STATUSES.includes(order.status) && reviewedOrderIds.has(order.id);
                const itemCount = order.items?.length ?? 0;

                return (
                  // FIX 6: dùng React.Fragment với key để tránh lệch dòng
                  <React.Fragment key={order.id}>
                    <tr>
                      <td style={{ textAlign: 'center', padding: '10px 6px' }}>
                        {itemCount > 0 && (
                          <button
                            onClick={() => toggleExpand(order.id)}
                            title={isExpanded ? 'Thu gọn' : 'Xem sản phẩm'}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontSize: '1rem', color: '#6b7280', padding: '2px 4px',
                              transition: 'transform 0.2s',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              display: 'inline-block',
                            }}
                          >▼</button>
                        )}
                      </td>
                      <td className={styles.orderId}>
                        #{order.id}
                        {itemCount > 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 400, marginLeft: 4 }}>
                            ({itemCount} sp)
                          </span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(order.orderDate).toLocaleString('vi-VN')}</td>
                      <td className={styles.totalAmount}>{formatPrice(order.totalAmount)}</td>
                      <td>{renderStatus(order.status)}</td>
                      {/* FIX 6+7: fix lệch - dùng div flex wrap, thêm nút Theo dõi đơn hàng */}
                      <td className={styles.actionCell}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                          {/* FIX 7: Nút Theo dõi đơn hàng */}
                          {['WaitingDeposit', 'DepositPaid', 'Processing', 'Shipping'].includes(order.status) && (
                            <button
                              onClick={() => navigate(`/payment/${order.id}`)}
                              className={styles.btnTrack}
                              title="Theo dõi đơn hàng"
                            >
                              📍 Theo dõi
                            </button>
                          )}
                          {order.status === 'WaitingDeposit' && (
                            <button
                              onClick={() => navigate(`/payment/${order.id}`)}
                              className={styles.btnPay}
                            >
                              💳 Thanh toán
                            </button>
                          )}
                          {order.status === 'WaitingDeposit' &&
                            (Date.now() - new Date(order.orderDate).getTime()) < 3 * 60 * 60 * 1000 && (
                              <button onClick={() => handleCancelOrder(order.id)} className={styles.btnCancel}>
                                Hủy đơn
                              </button>
                            )}
                          {canReview && (
                            <button onClick={() => openReviewModal(order.id)} className={styles.btnReview}>
                              ⭐ Đánh giá
                            </button>
                          )}
                          {hasReviewed && <span className={styles.reviewed}>✓ Đã đánh giá</span>}
                        </div>
                      </td>
                    </tr>

                    {/* FIX 6: hàng mở rộng dùng React.Fragment nên key đúng, không lệch */}
                    {isExpanded && itemCount > 0 && (
                      <tr className={styles.detailRow}>
                        <td colSpan={6} style={{ padding: 0, background: '#f9fafb' }}>
                          <div className={styles.itemList}>
                            {(order.shippingAddress || order.customerName) && (
                              <div className={styles.deliveryInfo}>
                                {order.customerName && <span>👤 {order.customerName}</span>}
                                {order.customerPhone && <span>📞 {order.customerPhone}</span>}
                                {order.shippingAddress && <span>📍 {order.shippingAddress}</span>}
                              </div>
                            )}

                            {order.items.map((item, idx) => (
                              <div key={idx} className={styles.itemRow}>
                                {item.productImage
                                  ? <img src={item.productImage} alt={item.productName} className={styles.itemImg} onError={e => { e.target.style.display = 'none' }} />
                                  : <div className={styles.itemImgPlaceholder}>🐟</div>
                                }
                                <div className={styles.itemInfo}>
                                  <Link to={`/product/${item.productId}`} className={styles.itemName}>
                                    {item.productName}
                                  </Link>
                                  {item.selectedGender && (
                                    <span className={styles.itemGender}>
                                      {item.selectedGender === 'Đực' ? '♂ Con đực'
                                        : item.selectedGender === 'Cái' ? '♀ Con cái'
                                        : '⚤ Cặp đôi'}
                                    </span>
                                  )}
                                </div>
                                <div className={styles.itemQty}>× {item.quantity}</div>
                                <div className={styles.itemPrice}>{formatPrice(item.unitPrice * item.quantity)}</div>
                              </div>
                            ))}

                            <div className={styles.itemTotal}>
                              <span>Tổng cộng:</span>
                              <strong>{formatPrice(order.totalAmount)}</strong>
                              {order.depositAmount > 0 && (
                                <span style={{ marginLeft: '1rem', color: '#6b7280', fontWeight: 400, fontSize: '0.85rem' }}>
                                  (Cọc 50%: {formatPrice(order.depositAmount)})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '2rem', maxWidth: 500, width: '100%', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <button onClick={closeReviewModal} style={{ position: 'absolute', top: '1rem', right: '1.2rem', background: 'none', border: 'none', fontSize: '1.6rem', cursor: 'pointer', color: '#888', lineHeight: 1 }}>×</button>

            {!showWarning && !reviewSuccess && (
              <>
                <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.2rem' }}>⭐ Đánh giá đơn hàng #{reviewOrderId}</h3>
                <p style={{ margin: '0 0 1.2rem', fontSize: '0.88rem', color: '#888' }}>Chia sẻ cảm nhận giúp chúng tôi phục vụ bạn tốt hơn</p>
                <div style={{ marginBottom: '1.1rem' }}>
                  <p style={{ margin: '0 0 0.4rem', fontWeight: 600 }}>Số sao:</p>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} onClick={() => setReviewForm(f => ({ ...f, rating: s }))}
                        style={{ fontSize: '2rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', lineHeight: 1, color: s <= reviewForm.rating ? '#f59e0b' : '#ddd' }}>★</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '1.1rem' }}>
                  <p style={{ margin: '0 0 0.4rem', fontWeight: 600 }}>Nhận xét:</p>
                  <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                    placeholder="Chia sẻ cảm nhận về sản phẩm, dịch vụ..." rows={4}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.93rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                </div>
                {reviewError && <p style={{ color: '#e53935', fontSize: '0.85rem', margin: '0 0 0.8rem' }}>{reviewError}</p>}
                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                  <button onClick={closeReviewModal} style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Hủy</button>
                  <button onClick={handleReviewNext} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: 'var(--teal,#2a9d8f)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Tiếp theo →</button>
                </div>
              </>
            )}

            {showWarning && !reviewSuccess && (
              <>
                <h3 style={{ margin: '0 0 1rem', color: '#92400e' }}>⚠️ Lưu ý quan trọng</h3>
                <div style={{ background: '#fff8e1', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '1rem 1.2rem', marginBottom: '1.2rem' }}>
                  <p style={{ margin: 0, color: '#78350f', lineHeight: 1.7, fontWeight: 500 }}>Chúng tôi sẽ giải quyết và hoàn tiền 100%, nhưng nếu bạn xác nhận chia sẻ đánh giá tôi sẽ không giải quyết vấn đề bạn gặp.</p>
                </div>
                <div style={{ background: '#f7f7f7', borderRadius: 8, padding: '0.9rem 1rem', marginBottom: '1.2rem' }}>
                  <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: '#f59e0b' }}>{'★'.repeat(reviewForm.rating)}</span>
                    <span style={{ color: '#d1d5db' }}>{'☆'.repeat(5 - reviewForm.rating)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>{reviewForm.comment}</p>
                </div>
                {reviewError && <p style={{ color: '#e53935', fontSize: '0.85rem', margin: '0 0 0.8rem' }}>{reviewError}</p>}
                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowWarning(false)} style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>← Quay lại</button>
                  <button onClick={handleReviewSubmit} disabled={reviewLoading}
                    style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#e53935', color: '#fff', fontWeight: 600, cursor: reviewLoading ? 'not-allowed' : 'pointer', opacity: reviewLoading ? 0.7 : 1 }}>
                    {reviewLoading ? 'Đang gửi...' : '✓ Xác nhận gửi đánh giá'}
                  </button>
                </div>
              </>
            )}

            {reviewSuccess && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '0.8rem' }}>✅</div>
                <h3 style={{ margin: '0 0 0.5rem' }}>Đã gửi đánh giá!</h3>
                <p style={{ color: '#666', margin: '0 0 1.5rem' }}>Cảm ơn bạn đã chia sẻ cảm nhận về đơn hàng #{reviewOrderId}.</p>
                <button onClick={closeReviewModal} style={{ padding: '0.65rem 1.8rem', borderRadius: 8, border: 'none', background: 'var(--teal,#2a9d8f)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Đóng</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}