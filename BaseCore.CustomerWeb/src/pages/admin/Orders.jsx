import { useState, useEffect } from 'react';
import { buildUrl, getHeaders, handleResponse } from '../../services/utils/apiClient';

const STATUS_LIST = [
  { value: 'WaitingDeposit', label: 'Chờ đặt cọc',        badge: 'badge-warning', icon: 'fa-hourglass-half',  next: 'DepositPaid', nextLabel: 'Xác nhận cọc',   nextBtn: 'btn-success' },
  { value: 'DepositPaid',    label: 'Đã đặt cọc',          badge: 'badge-primary', icon: 'fa-money-bill-wave', next: 'Processing',  nextLabel: 'Bắt đầu xử lý', nextBtn: 'btn-info'    },
  { value: 'Processing',     label: 'Đang xử lý',          badge: 'badge-info',    icon: 'fa-cog',             next: 'Shipping',    nextLabel: 'Giao hàng',      nextBtn: 'btn-primary' },
  { value: 'Shipping',       label: 'Đang giao',            badge: 'badge-info',    icon: 'fa-truck',           next: 'Delivered',   nextLabel: 'Xác nhận đã giao', nextBtn: 'btn-success'},
  { value: 'Delivered',      label: 'Đã giao hàng',         badge: 'badge-secondary', icon: 'fa-box-open',      next: null,          nextLabel: null,              nextBtn: null          },
  { value: 'Completed',      label: 'Hoàn thành',           badge: 'badge-success', icon: 'fa-check-circle',    next: null,          nextLabel: null,              nextBtn: null          },
  { value: 'Cancelled',      label: 'Đã hủy',               badge: 'badge-danger',  icon: 'fa-times-circle',    next: null,          nextLabel: null,              nextBtn: null          },
];

const statusLabel = (val) =>
  STATUS_LIST.find(s => s.value === val) || { label: val, badge: 'badge-secondary' };

// Fix: always await fetch before passing to handleResponse
const orderService = {
  getAll: async () => {
    const res = await fetch(buildUrl('/api/orders/all'), { headers: getHeaders(true) });
    const data = await handleResponse(res, 'Failed to fetch orders');
    if (Array.isArray(data)) return data;
    if (data && data.items) return data.items;
    if (data && data.data) return data.data;
    return [];
  },

  getDetail: async (id) => {
    const res = await fetch(buildUrl('/api/orders/' + id), { headers: getHeaders(true) });
    return handleResponse(res, 'Failed to fetch order');
  },

  updateStatus: async (id, status) => {
    const res = await fetch(buildUrl('/api/orders/' + id + '/status'), {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res, 'Failed to update status');
  },

  cancelOrder: async (id) => {
    const res = await fetch(buildUrl('/api/orders/' + id + '/cancel'), {
      method: 'PUT',
      headers: getHeaders(true),
    });
    return handleResponse(res, 'Failed to cancel order');
  },
};

// Confirm popup component
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <>
      <div className="modal fade show" style={{ display: 'block', zIndex: 1060 }} tabIndex="-1">
        <div className="modal-dialog modal-sm modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Xác nhận</h5>
              <button className="close" onClick={onCancel}><span>&times;</span></button>
            </div>
            <div className="modal-body">
              <p>{message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={onCancel}>Hủy</button>
              <button className="btn btn-primary btn-sm" onClick={onConfirm}>Xác nhận</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1055 }}></div>
    </>
  );
}

export default function Orders() {
  const now = new Date();
  const YEARS = [];
  for (let y = 2024; y <= now.getFullYear() + 1; y++) YEARS.push(y);

  const [orders, setOrders]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilter]   = useState('');
  const [keyword, setKeyword]       = useState('');
  const [fromDay, setFromDay]       = useState('');
  const [fromMonth, setFromMonth]   = useState('');
  const [fromYear, setFromYear]     = useState('');
  const [toDay, setToDay]           = useState('');
  const [toMonth, setToMonth]       = useState('');
  const [toYear, setToYear]         = useState('');
  const [selected, setSelected]     = useState(null);
  const [detail, setDetail]         = useState(null);
  const [detailLoading, setDL]      = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [updating, setUpdating]     = useState(false);
  const [error, setError]           = useState('');
  const [confirm, setConfirm]       = useState(null); // { message, onConfirm }
  const [page, setPage]             = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => { loadOrders(); }, []);
  useEffect(() => { setPage(1); }, [filterStatus, keyword, fromDay, fromMonth, fromYear, toDay, toMonth, toYear]);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await orderService.getAll();
      setOrders(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const askConfirm = (message) =>
    new Promise((resolve) => {
      setConfirm({
        message,
        onConfirm: () => { setConfirm(null); resolve(true); },
        onCancel:  () => { setConfirm(null); resolve(false); },
      });
    });

  const openDetail = async (order) => {
    setSelected(order);
    setShowDetail(true);
    setDL(true);
    try {
      const data = await orderService.getDetail(order.id);
      setDetail(data && data.order ? { ...data.order, details: data.details } : data);
    } catch (e) {
      setDetail(null);
    } finally {
      setDL(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    const ok = await askConfirm('Cập nhật trạng thái thành "' + statusLabel(status).label + '"?');
    if (!ok) return;
    setUpdating(true);
    try {
      await orderService.updateStatus(id, status);
      // Cập nhật danh sách đơn hàng
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
      // Cập nhật đơn đang xem trong detail modal
      if (selected && selected.id === id) {
        setSelected(prev => ({ ...prev, status }));
        setDetail(prev => prev ? { ...prev, status } : prev);
      }
    } catch (e) {
      setError('Cập nhật thất bại: ' + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = async (id) => {
    const ok = await askConfirm('Bạn có chắc chắn muốn hủy đơn hàng này?');
    if (!ok) return;
    setUpdating(true);
    try {
      await orderService.cancelOrder(id);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'Cancelled' } : o));
      if (selected && selected.id === id) {
        setSelected(prev => ({ ...prev, status: 'Cancelled' }));
      }
    } catch (e) {
      setError('Hủy thất bại: ' + e.message);
    } finally {
      setUpdating(false);
    }
  };

  const filtered = orders.filter(o => {
    const matchStatus  = filterStatus ? o.status === filterStatus : true;
    const matchKeyword = keyword
      ? String(o.id).includes(keyword) || (o.shippingAddress || '').toLowerCase().includes(keyword.toLowerCase())
      : true;
    const orderDate = new Date(o.orderDate);
    let matchFrom = true;
    if (fromYear || fromMonth || fromDay) {
      const y = parseInt(fromYear) || 2024;
      const m = parseInt(fromMonth) || 1;
      const d = parseInt(fromDay) || 1;
      matchFrom = orderDate >= new Date(y, m - 1, d, 0, 0, 0);
    }
    let matchTo = true;
    if (toYear || toMonth || toDay) {
      const y = parseInt(toYear) || now.getFullYear();
      const m = parseInt(toMonth) || 12;
      const dInMonth = new Date(y, m, 0).getDate();
      const d = parseInt(toDay) || dInMonth;
      matchTo = orderDate <= new Date(y, m - 1, d, 23, 59, 59);
    }
    return matchStatus && matchKeyword && matchFrom && matchTo;
  });

  const countBy = (s) => orders.filter(o => o.status === s).length;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <div className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1 className="m-0">
                <i className="fas fa-receipt mr-2"></i>Quản lý Đơn hàng
              </h1>
            </div>
            <div className="col-sm-6">
              <ol className="breadcrumb float-sm-right">
                <li className="breadcrumb-item"><a href="#">Trang chủ</a></li>
                <li className="breadcrumb-item active">Đơn hàng</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <section className="content">
        <div className="container-fluid">

          {error && (
            <div className="alert alert-danger alert-dismissible">
              {error}
              <button className="close" onClick={() => setError('')}><span>&times;</span></button>
            </div>
          )}

          <div className="row mb-3">
            {STATUS_LIST.map(s => (
              <div className="col-6 col-md-2 mb-2" key={s.value}>
                <div
                  className={'small-box ' + s.badge.replace('badge-', 'bg-') + ' mb-0'}
                  style={{ cursor: 'pointer', opacity: filterStatus === s.value ? 1 : 0.72, transition: 'opacity 0.2s' }}
                  onClick={() => setFilter(filterStatus === s.value ? '' : s.value)}
                >
                  <div className="inner">
                    <h4>{countBy(s.value)}</h4>
                    <p style={{ fontSize: '0.82rem', marginBottom: 0 }}>{s.label}</p>
                  </div>
                  <div className="icon">
                    <i className={`fas ${s.icon}`}></i>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              {/* Hàng 1: tìm kiếm + trạng thái */}
              <div className="row align-items-center mb-2">
                <div className="col-md-5">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tìm theo mã đơn / địa chỉ..."
                      value={keyword}
                      onChange={e => setKeyword(e.target.value)}
                    />
                    <div className="input-group-append">
                      <span className="input-group-text"><i className="fas fa-search"></i></span>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <select className="form-control" value={filterStatus} onChange={e => setFilter(e.target.value)}>
                    <option value="">-- Tất cả trạng thái --</option>
                    {STATUS_LIST.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 text-right">
                  <span className="text-muted">Tổng: <strong>{filtered.length}</strong> đơn</span>
                </div>
              </div>

              {/* Hàng 2: lọc theo ngày */}
              <div className="row align-items-center">
                <div className="col-auto">
                  <small className="text-muted font-weight-bold">Lọc theo ngày:</small>
                </div>
                <div className="col-auto">
                  <small className="text-muted mr-1">Từ</small>
                </div>
                <div className="col-auto px-1">
                  <select className="form-control form-control-sm" style={{ width: 75 }} value={fromDay} onChange={e => setFromDay(e.target.value)}>
                    <option value="">Ngày</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Ngày {d}</option>
                    ))}
                  </select>
                </div>
                <div className="col-auto px-1">
                  <select className="form-control form-control-sm" style={{ width: 100 }} value={fromMonth} onChange={e => setFromMonth(e.target.value)}>
                    <option value="">Tháng</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div className="col-auto px-1">
                  <select className="form-control form-control-sm" style={{ width: 85 }} value={fromYear} onChange={e => setFromYear(e.target.value)}>
                    <option value="">Năm</option>
                    {YEARS.map(y => <option key={y} value={y}>Năm {y}</option>)}
                  </select>
                </div>

                <div className="col-auto px-2">
                  <small className="text-muted">đến</small>
                </div>

                <div className="col-auto px-1">
                  <select className="form-control form-control-sm" style={{ width: 75 }} value={toDay} onChange={e => setToDay(e.target.value)}>
                    <option value="">Ngày</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>Ngày {d}</option>
                    ))}
                  </select>
                </div>
                <div className="col-auto px-1">
                  <select className="form-control form-control-sm" style={{ width: 100 }} value={toMonth} onChange={e => setToMonth(e.target.value)}>
                    <option value="">Tháng</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
                <div className="col-auto px-1">
                  <select className="form-control form-control-sm" style={{ width: 85 }} value={toYear} onChange={e => setToYear(e.target.value)}>
                    <option value="">Năm</option>
                    {YEARS.map(y => <option key={y} value={y}>Năm {y}</option>)}
                  </select>
                </div>

                <div className="col-auto ml-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setFilter(''); setKeyword('');
                    setFromDay(''); setFromMonth(''); setFromYear('');
                    setToDay(''); setToMonth(''); setToYear('');
                  }}>
                    <i className="fas fa-redo mr-1"></i>Đặt lại
                  </button>
                </div>
              </div>
            </div>

            <div className="card-body p-0">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"></div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-4 text-muted">Không có đơn hàng nào</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-striped mb-0">
                    <thead className="thead-dark">
                      <tr>
                        <th>Mã đơn</th>
                        <th>Khách hàng</th>
                        <th>Ngày đặt</th>
                        <th>Tổng tiền</th>
                        <th>Đặt cọc</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map(order => {
                        const st = statusLabel(order.status);
                        return (
                          <tr key={order.id}>
                            <td><strong>#{order.id}</strong></td>
                            <td>
                              <div><strong>{order.customerName || '—'}</strong></div>
                              <div><small className="text-muted">{order.customerPhone || ''}</small></div>
                            </td>
                            <td>
                              <div>{new Date(order.orderDate).toLocaleDateString('vi-VN')}</div>
                              <div><small className="text-muted">{new Date(order.orderDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small></div>
                            </td>
                            <td><strong>{(order.totalAmount ?? 0).toLocaleString('vi-VN')} đ</strong></td>
                            <td>
                              <span className={order.status === 'WaitingDeposit' ? 'text-warning font-weight-bold' : 'text-success'}>
                                {(order.depositAmount ?? 0).toLocaleString('vi-VN')} đ
                              </span>
                            </td>
                            <td><span className={'badge ' + st.badge}><i className={`fas ${st.icon} mr-1`}></i>{st.label}</span></td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button className="btn btn-sm btn-outline-primary mr-1" onClick={() => openDetail(order)} title="Xem chi tiết">
                                <i className="fas fa-eye"></i>
                              </button>
                              <select
                                className="form-control form-control-sm d-inline-block mr-1"
                                value={order.status}
                                onChange={e => handleUpdateStatus(order.id, e.target.value)}
                                disabled={updating || ['Delivered', 'Completed', 'Cancelled'].includes(order.status)}
                                style={{ width: 140, verticalAlign: 'middle' }}
                              >
                                {STATUS_LIST.map(s => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                              {order.status === 'WaitingDeposit' && (
                                <button className="btn btn-sm btn-danger" onClick={() => handleCancel(order.id)} disabled={updating} title="Hủy đơn">
                                  <i className="fas fa-times"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {!loading && filtered.length > 0 && (
              <div className="card-footer d-flex justify-content-between align-items-center">
                <span className="text-muted small">
                  Hiển thị <strong>{(page - 1) * PAGE_SIZE + 1}</strong>–<strong>{Math.min(page * PAGE_SIZE, filtered.length)}</strong> / <strong>{filtered.length}</strong> đơn hàng
                </span>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setPage(1)} disabled={page === 1}>
                      <i className="fas fa-angle-double-left"></i>
                    </button>
                  </li>
                  <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                      <i className="fas fa-angle-left"></i>
                    </button>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '...' ? (
                        <li key={`ellipsis-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li key={p} className={`page-item ${page === p ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                        </li>
                      )
                    )}
                  <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                      <i className="fas fa-angle-right"></i>
                    </button>
                  </li>
                  <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                      <i className="fas fa-angle-double-right"></i>
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Detail Modal */}
      {showDetail && selected && (
        <>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1050, overflowY: 'auto' }} tabIndex="-1">
            <div className="modal-dialog modal-xl" style={{ margin: '1.5rem auto' }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Đơn hàng <strong>#{selected.id}</strong>
                    <span className={'badge ' + statusLabel(selected.status).badge + ' ml-2'}>
                      {statusLabel(selected.status).label}
                    </span>
                  </h5>
                  <button className="close" onClick={() => setShowDetail(false)}><span>&times;</span></button>
                </div>
                <div className="modal-body">
                  {detailLoading ? (
                    <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>
                  ) : (
                    <>
                      {/* Thông tin khách hàng */}
                      <div className="row mb-3">
                        <div className="col-md-6">
                          <table className="table table-sm table-borderless mb-0">
                            <tbody>
                              <tr>
                                <td className="text-muted pl-0" style={{ width: 110 }}>👤 Khách hàng</td>
                                <td><strong>{(detail || selected).customerName || '—'}</strong></td>
                              </tr>
                              <tr>
                                <td className="text-muted pl-0">📞 Số điện thoại</td>
                                <td>
                                  <strong>{(detail || selected).customerPhone || '—'}</strong>
                                  {(detail || selected).customerPhone && (
                                    <a href={'tel:' + (detail || selected).customerPhone} className="btn btn-sm btn-outline-success ml-2 py-0 px-1">
                                      <i className="fas fa-phone"></i>
                                    </a>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <td className="text-muted pl-0">🏠 Địa chỉ giao</td>
                                <td>{(detail || selected).shippingAddress || '—'}</td>
                              </tr>
                              <tr>
                                <td className="text-muted pl-0">📅 Ngày đặt</td>
                                <td>{new Date(selected.orderDate).toLocaleString('vi-VN')}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="col-md-6">
                          <div className="card border-0 bg-light">
                            <div className="card-body py-2">
                              <div className="d-flex justify-content-between mb-1">
                                <span className="text-muted">Tổng đơn hàng:</span>
                                <strong>{(selected.totalAmount ?? 0).toLocaleString('vi-VN')} đ</strong>
                              </div>
                              <div className="d-flex justify-content-between mb-1">
                                <span className="text-warning">Đặt cọc (50%):</span>
                                <strong className="text-warning">{(selected.depositAmount ?? 0).toLocaleString('vi-VN')} đ</strong>
                              </div>
                              <div className="d-flex justify-content-between">
                                <span className="text-muted">Còn lại khi nhận:</span>
                                <span>{((selected.totalAmount || 0) - (selected.depositAmount || 0)).toLocaleString('vi-VN')} đ</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <table className="table table-bordered table-sm">
                        <thead className="thead-light">
                          <tr>
                            <th>Sản phẩm</th>
                            <th className="text-center">Giới tính</th>
                            <th className="text-center">SL</th>
                            <th className="text-right">Đơn giá</th>
                            <th className="text-right">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {((detail && detail.details) || (detail && detail.orderDetails) || []).map((item, i) => (
                            <tr key={i}>
                              <td>{(item.product && item.product.name) || item.productName || ('Sản phẩm #' + item.productId)}</td>
                              <td className="text-center">
                                {item.selectedGender ? (
                                  <span className={'badge ' + (item.selectedGender === 'Đực' ? 'badge-primary' : item.selectedGender === 'Cái' ? 'badge-danger' : 'badge-success')}>
                                    {item.selectedGender === 'Cặp' ? '🐟 Cặp đôi' : `Con ${item.selectedGender}`}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="text-center">{item.quantity}</td>
                              <td className="text-right">{(item.unitPrice ?? 0).toLocaleString('vi-VN')} đ</td>
                              <td className="text-right">{((item.unitPrice ?? 0) * item.quantity).toLocaleString('vi-VN')} đ</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={4} className="text-right">Tổng đơn hàng:</td>
                            <td className="text-right"><strong>{(selected.totalAmount ?? 0).toLocaleString('vi-VN')} đ</strong></td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="text-right text-warning">Đặt cọc (50%):</td>
                            <td className="text-right text-warning"><strong>{(selected.depositAmount ?? 0).toLocaleString('vi-VN')} đ</strong></td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Cập nhật trạng thái */}
                      <div className="mt-3">
                        <strong>Cập nhật trạng thái:</strong>
                        <div className="mt-2 d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                          {['Delivered', 'Completed', 'Cancelled'].includes(selected.status) ? (
                            <span className="text-muted small">
                              <i className="fas fa-lock mr-1"></i>
                              {selected.status === 'Delivered'
                                ? 'Đã giao — chờ khách xác nhận nhận hàng'
                                : selected.status === 'Completed'
                                  ? 'Đơn hàng đã hoàn thành'
                                  : 'Đơn hàng đã bị hủy'}
                            </span>
                          ) : (() => {
                            const stInfo = statusLabel(selected.status);
                            return (
                              <>
                                {stInfo.next && (
                                  <button
                                    className={`btn btn-sm ${stInfo.nextBtn}`}
                                    onClick={() => handleUpdateStatus(selected.id, stInfo.next)}
                                    disabled={updating}
                                  >
                                    <i className="fas fa-arrow-right mr-1"></i>{stInfo.nextLabel}
                                  </button>
                                )}
                                {['WaitingDeposit', 'DepositPaid', 'Processing'].includes(selected.status) && (
                                  <button className="btn btn-sm btn-danger" onClick={() => handleCancel(selected.id)} disabled={updating}>
                                    <i className="fas fa-ban mr-1"></i> Hủy đơn
                                  </button>
                                )}
                                {updating && <div className="spinner-border spinner-border-sm text-primary" role="status"></div>}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowDetail(false)}>Đóng</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1045 }}></div>
        </>
      )}

      {/* Confirm Popup */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      )}
    </>
  );
}