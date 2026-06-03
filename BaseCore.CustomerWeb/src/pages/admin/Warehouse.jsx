import React, { useState, useEffect } from 'react';
import { warehouseService } from '../../services/warehouse/warehouseService';
import { productService } from '../../services/product/productService';
import { useAuth } from '../../context/AuthContext';
import { exportWarehouseReportToWord } from '../../services/warehouse/warehouseWordExport';

const STATUS_LABELS = { Good: 'Tốt', Damaged: 'Hỏng', Maintenance: 'Đang sửa' };
const STATUS_COLORS = { Good: 'success', Damaged: 'danger', Maintenance: 'warning' };
const TYPE_LABELS   = { Accessory: 'Phụ kiện', Equipment: 'Thiết bị' };

export default function Warehouse() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tanks');

  // Bể cá state
  const [tanks, setTanks]               = useState([]);
  const [tanksTotal, setTanksTotal]     = useState(0);
  const [tankPage, setTankPage]         = useState(1);
  const [tankKeyword, setTankKeyword]   = useState('');
  const [tanksLoading, setTanksLoading] = useState(false);

  // Phụ kiện state
  const [accessories, setAccessories]         = useState([]);
  const [accTotal, setAccTotal]               = useState(0);
  const [accPage, setAccPage]                 = useState(1);
  const [accKeyword, setAccKeyword]           = useState('');
  const [accType, setAccType]                 = useState('');
  const [accLoading, setAccLoading]           = useState(false);

  // Commit log state
  const [commits, setCommits]         = useState([]);
  const [commitsTotal, setCommitsTotal] = useState(0);
  const [commitPage, setCommitPage]   = useState(1);
  const [commitsLoading, setCommitsLoading] = useState(false);

  // Sản phẩm cá (cat 1,2) để chọn bể — phụ kiện (cat 3,4) để chọn accessory
  const [products, setProducts]       = useState([]);
  const [accProducts, setAccProducts] = useState([]);

  // Modal
  const [showModal, setShowModal]     = useState(false);
  const [modalType, setModalType]     = useState(''); // 'tank' | 'accessory'
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData]       = useState({});
  const [commitMsg, setCommitMsg]     = useState('');
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [syncing, setSyncing]         = useState(false);

  // Loss modal
  const [lossModal, setLossModal]     = useState({ show: false, type: '', item: null });
  const [lossForm, setLossForm]       = useState({});
  const [lossReason, setLossReason]   = useState('');
  const [lossError, setLossError]     = useState('');
  const [lossSaving, setLossSaving]   = useState(false);

  // Báo cáo hao hụt
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = (() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; })();
  const [reportFrom, setReportFrom]       = useState(firstOfMonth);
  const [reportTo, setReportTo]           = useState(today);
  const [reportGroupBy, setReportGroupBy] = useState('month');
  const [reportData, setReportData]       = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportExpanded, setReportExpanded] = useState({});
  const [exportLoading, setExportLoading]   = useState(false);

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { if (activeTab === 'tanks') loadTanks(); },       [activeTab, tankPage]);
  useEffect(() => { if (activeTab === 'accessories') loadAccessories(); }, [activeTab, accPage, accType]);
  useEffect(() => { if (activeTab === 'commits') loadCommits(); },   [activeTab, commitPage]);
  useEffect(() => { if (activeTab === 'report') loadReport(); },     [activeTab]);

  const loadProducts = async () => {
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        productService.getAll('', 1, 1, 200),
        productService.getAll('', 2, 1, 200),
        productService.getAll('', 3, 1, 200),
        productService.getAll('', 4, 1, 200),
        productService.getAll('', 5, 1, 200),
      ]);
      setProducts([...(r1.items || []), ...(r2.items || [])]);
      setAccProducts([...(r3.items || []), ...(r4.items || []), ...(r5.items || [])]);
    } catch { /* ignore */ }
  };

  const loadTanks = async () => {
    setTanksLoading(true);
    try {
      const res = await warehouseService.getTanks(tankKeyword, tankPage);
      setTanks(res.items || []);
      setTanksTotal(res.total || 0);
    } catch (e) { console.error(e); }
    finally { setTanksLoading(false); }
  };

  const loadAccessories = async () => {
    setAccLoading(true);
    try {
      const res = await warehouseService.getAccessories(accKeyword, accType, accPage);
      setAccessories(res.items || []);
      setAccTotal(res.total || 0);
    } catch (e) { console.error(e); }
    finally { setAccLoading(false); }
  };

  const loadCommits = async () => {
    setCommitsLoading(true);
    try {
      const res = await warehouseService.getCommits(user?.userId || '', '', commitPage);
      setCommits(res.items || []);
      setCommitsTotal(res.total || 0);
    } catch (e) { console.error(e); }
    finally { setCommitsLoading(false); }
  };

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const res = await warehouseService.getLossReport(reportFrom, reportTo, reportGroupBy);
      setReportData(res);
    } catch (e) { console.error(e); }
    finally { setReportLoading(false); }
  };

  const handleExportWord = async () => {
    if (!reportData) return;
    setExportLoading(true);
    try {
      await exportWarehouseReportToWord(reportData, reportFrom, reportTo, reportGroupBy);
    } catch (e) { alert('Lỗi khi xuất file: ' + e.message); }
    finally { setExportLoading(false); }
  };

  // ── Modal helpers ──────────────────────────────────────────────
  const openTankModal = (tank = null) => {
    setModalType('tank');
    setEditingItem(tank);
    setFormData(tank ? {
      tankName: tank.tankName, productId: tank.productId,
      maleCount: tank.maleCount, femaleCount: tank.femaleCount, notes: tank.notes || ''
    } : { tankName: '', productId: '', maleCount: 0, femaleCount: 0, notes: '' });
    setCommitMsg('');
    setError('');
    setShowModal(true);
  };

  const openAccModal = (acc = null) => {
    setModalType('accessory');
    setEditingItem(acc);
    setFormData(acc ? {
      productId: acc.productId || '', name: acc.name, type: acc.type,
      quantity: acc.quantity, unit: acc.unit || '', status: acc.status, description: acc.description || ''
    } : { productId: '', name: '', type: 'Accessory', quantity: 0, unit: 'cái', status: 'Good', description: '' });
    setCommitMsg('');
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const staffId   = user?.userId || '';
      const staffName = user?.name || user?.username || '';

      if (modalType === 'tank') {
        if (!formData.productId)
          return setError('Vui lòng chọn loài cá');
        const payload = { ...formData, staffId, staffName, commitMessage: commitMsg || undefined };
        if (editingItem) {
          await warehouseService.updateTank(editingItem.id, payload);
        } else {
          const res = await warehouseService.createTank(payload);
          if (res?.updated) {
            alert(res.message);
          }
        }
        loadTanks();
      } else {
        if (!formData.productId && !formData.name)
          return setError('Vui lòng chọn sản phẩm hoặc nhập tên');
        const payload = { ...formData, staffId, staffName, commitMessage: commitMsg || undefined };
        if (editingItem) {
          await warehouseService.updateAccessory(editingItem.id, payload);
        } else {
          const res = await warehouseService.createAccessory(payload);
          if (res?.updated) alert(res.message);
        }
        loadAccessories();
      }
      setShowModal(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDeleteTank = async (tank) => {
    if (!window.confirm(`Xoá bể "${tank.tankName}"?`)) return;
    try {
      await warehouseService.deleteTank(tank.id, user?.userId || '', user?.name || '');
      loadTanks();
    } catch (e) { alert(e.message); }
  };

  const handleDeleteAcc = async (acc) => {
    if (!window.confirm(`Xoá "${acc.name}"?`)) return;
    try {
      await warehouseService.deleteAccessory(acc.id, user?.userId || '', user?.name || '');
      loadAccessories();
    } catch (e) { alert(e.message); }
  };

  const handleSync = async () => {
    if (!window.confirm('Tự động tạo bể cho tất cả loài cá chưa có bể trong kho?\nSố lượng sẽ lấy từ MaleStock/FemaleStock của sản phẩm.')) return;
    setSyncing(true);
    try {
      const staffId   = user?.userId || '';
      const staffName = user?.name || user?.username || '';
      const res = await warehouseService.syncFromProducts(staffId, staffName);
      alert(res.message || `Đồng bộ: tạo ${res.created} bể mới, cập nhật ${res.updated} bể.`);
      if ((res.created || 0) + (res.updated || 0) > 0) loadTanks();
    } catch (e) { alert(e.message); }
    finally { setSyncing(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString('vi-VN') : '';

  const openTankLoss = (tank) => {
    setLossModal({ show: true, type: 'tank', item: tank });
    setLossForm({ maleLoss: 0, femaleLoss: 0 });
    setLossReason('');
    setLossError('');
  };

  const openAccLoss = (acc) => {
    setLossModal({ show: true, type: 'accessory', item: acc });
    setLossForm({ quantityLoss: 0 });
    setLossReason('');
    setLossError('');
  };

  const handleLossSave = async () => {
    if (!lossReason.trim()) return setLossError('Vui lòng nhập lý do');
    setLossSaving(true);
    setLossError('');
    try {
      const staffId   = user?.userId || '';
      const staffName = user?.name || user?.username || '';
      if (lossModal.type === 'tank') {
        const res = await warehouseService.recordTankLoss(lossModal.item.id, {
          ...lossForm, reason: lossReason, staffId, staffName,
        });
        alert(res.message);
        loadTanks();
      } else {
        const res = await warehouseService.recordAccessoryLoss(lossModal.item.id, {
          ...lossForm, reason: lossReason, staffId, staffName,
        });
        alert(res.message);
        loadAccessories();
      }
      setLossModal({ show: false, type: '', item: null });
    } catch (e) { setLossError(e.message); }
    finally { setLossSaving(false); }
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
      <div className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1 className="m-0">
                <i className="fas fa-warehouse mr-2"></i>Quản lý kho
              </h1>
            </div>
          </div>
        </div>
      </div>

      <section className="content">
        <div className="container-fluid">
          {/* Tabs */}
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'tanks' ? 'active' : ''}`}
                onClick={() => setActiveTab('tanks')}>
                <i className="fas fa-fish mr-1"></i> Bể cá
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'accessories' ? 'active' : ''}`}
                onClick={() => setActiveTab('accessories')}>
                <i className="fas fa-tools mr-1"></i> Phụ kiện &amp; Thiết bị
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'commits' ? 'active' : ''}`}
                onClick={() => setActiveTab('commits')}>
                <i className="fas fa-history mr-1"></i> Lịch sử cập nhật
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => setActiveTab('report')}>
                <i className="fas fa-chart-bar mr-1"></i> Báo cáo hao hụt
              </button>
            </li>
          </ul>

          {/* ─── Tab Bể cá ───────────────────────────────────── */}
          {activeTab === 'tanks' && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h3 className="card-title">
                  <i className="fas fa-fish mr-1"></i> Theo dõi cá trong bể
                </h3>
                <div>
                  <button className="btn btn-warning btn-sm mr-2" onClick={handleSync} disabled={syncing}>
                    {syncing
                      ? <><i className="fas fa-spinner fa-spin mr-1"></i> Đang đồng bộ...</>
                      : <><i className="fas fa-sync mr-1"></i> Đồng bộ từ sản phẩm</>}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => openTankModal()}>
                    <i className="fas fa-plus mr-1"></i> Thêm bể
                  </button>
                </div>
              </div>
              <div className="card-body">
                <form className="form-inline mb-3" onSubmit={e => { e.preventDefault(); setTankPage(1); loadTanks(); }}>
                  <input className="form-control mr-2" placeholder="Tìm tên bể, loài cá..."
                    value={tankKeyword} onChange={e => setTankKeyword(e.target.value)} />
                  <button className="btn btn-secondary btn-sm" type="submit">
                    <i className="fas fa-search"></i>
                  </button>
                </form>

                {tanksLoading ? (
                  <div className="text-center py-4"><i className="fas fa-spinner fa-spin fa-2x"></i></div>
                ) : tanks.length === 0 ? (
                  <div className="text-center text-muted py-4">Chưa có bể nào. Hãy thêm bể đầu tiên!</div>
                ) : (
                  <div className="row">
                    {tanks.map(tank => (
                      <div key={tank.id} className="col-md-4 mb-3">
                        <div className="card card-outline card-info">
                          <div className="card-header">
                            <h5 className="card-title mb-0">
                              <i className="fas fa-water mr-1 text-info"></i> {tank.tankName}
                            </h5>
                          </div>
                          <div className="card-body py-2">
                            <p className="mb-1">
                              <strong>Loài:</strong> {tank.productName || <span className="text-muted">N/A</span>}
                            </p>
                            <div className="d-flex justify-content-around text-center my-2">
                              <div>
                                <div className="text-primary font-weight-bold" style={{ fontSize: '1.4rem' }}>{tank.maleCount}</div>
                                <small>Đực</small>
                              </div>
                              <div>
                                <div className="text-danger font-weight-bold" style={{ fontSize: '1.4rem' }}>{tank.femaleCount}</div>
                                <small>Cái</small>
                              </div>
                              <div>
                                <div className="text-success font-weight-bold" style={{ fontSize: '1.4rem' }}>{tank.totalCount}</div>
                                <small>Tổng</small>
                              </div>
                            </div>
                            {tank.notes && <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}><i>{tank.notes}</i></p>}
                            <small className="text-muted">Cập nhật: {fmtDate(tank.lastUpdated)} bởi {tank.lastUpdatedByName}</small>
                          </div>
                          <div className="card-footer d-flex justify-content-end" style={{ padding: '0.4rem 0.75rem' }}>
                            <button className="btn btn-sm btn-outline-warning mr-2" title="Ghi nhận cá chết / hao hụt" onClick={() => openTankLoss(tank)}>
                              <i className="fas fa-skull-crossbones"></i>
                            </button>
                            <button className="btn btn-sm btn-outline-primary mr-2" onClick={() => openTankModal(tank)}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteTank(tank)}>
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="d-flex justify-content-between align-items-center mt-2">
                  <small className="text-muted">Tổng: {tanksTotal} bể</small>
                  <div>
                    <button className="btn btn-sm btn-light mr-1" disabled={tankPage <= 1}
                      onClick={() => setTankPage(p => p - 1)}>&laquo;</button>
                    <button className="btn btn-sm btn-light" disabled={tanks.length < 20}
                      onClick={() => setTankPage(p => p + 1)}>&raquo;</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Tab Phụ kiện & Thiết bị ─────────────────────── */}
          {activeTab === 'accessories' && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h3 className="card-title">
                  <i className="fas fa-tools mr-1"></i> Phụ kiện &amp; Thiết bị
                </h3>
                <button className="btn btn-primary btn-sm" onClick={() => openAccModal()}>
                  <i className="fas fa-plus mr-1"></i> Thêm mới
                </button>
              </div>
              <div className="card-body">
                <div className="form-inline mb-3">
                  <input className="form-control mr-2" placeholder="Tìm tên..."
                    value={accKeyword} onChange={e => setAccKeyword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setAccPage(1); loadAccessories(); } }} />
                  <select className="form-control mr-2" value={accType}
                    onChange={e => { setAccType(e.target.value); setAccPage(1); }}>
                    <option value="">Tất cả loại</option>
                    <option value="Accessory">Phụ kiện</option>
                    <option value="Equipment">Thiết bị</option>
                  </select>
                  <button className="btn btn-secondary btn-sm"
                    onClick={() => { setAccPage(1); loadAccessories(); }}>
                    <i className="fas fa-search"></i>
                  </button>
                </div>

                {accLoading ? (
                  <div className="text-center py-4"><i className="fas fa-spinner fa-spin fa-2x"></i></div>
                ) : accessories.length === 0 ? (
                  <div className="text-center text-muted py-4">Chưa có dữ liệu</div>
                ) : (
                  <table className="table table-bordered table-hover table-sm">
                    <thead className="thead-light">
                      <tr>
                        <th>Tên</th>
                        <th>Loại</th>
                        <th style={{ width: 80 }}>Số lượng</th>
                        <th style={{ width: 60 }}>ĐV</th>
                        <th style={{ width: 110 }}>Trạng thái</th>
                        <th>Mô tả</th>
                        <th style={{ width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessories.map(acc => (
                        <tr key={acc.id}>
                          <td><strong>{acc.name}</strong></td>
                          <td>
                            <span className={`badge badge-${acc.type === 'Equipment' ? 'info' : 'secondary'}`}>
                              {TYPE_LABELS[acc.type] || acc.type}
                            </span>
                          </td>
                          <td className="text-center font-weight-bold">{acc.quantity}</td>
                          <td className="text-muted">{acc.unit}</td>
                          <td>
                            <span className={`badge badge-${STATUS_COLORS[acc.status] || 'light'}`}>
                              {STATUS_LABELS[acc.status] || acc.status}
                            </span>
                          </td>
                          <td><small className="text-muted">{acc.description}</small></td>
                          <td>
                            <button className="btn btn-xs btn-outline-warning mr-1" title="Ghi nhận hư hỏng / thất thoát" onClick={() => openAccLoss(acc)}>
                              <i className="fas fa-exclamation-triangle"></i>
                            </button>
                            <button className="btn btn-xs btn-outline-primary mr-1" onClick={() => openAccModal(acc)}>
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="btn btn-xs btn-outline-danger" onClick={() => handleDeleteAcc(acc)}>
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="d-flex justify-content-between align-items-center mt-2">
                  <small className="text-muted">Tổng: {accTotal} mục</small>
                  <div>
                    <button className="btn btn-sm btn-light mr-1" disabled={accPage <= 1}
                      onClick={() => setAccPage(p => p - 1)}>&laquo;</button>
                    <button className="btn btn-sm btn-light" disabled={accessories.length < 20}
                      onClick={() => setAccPage(p => p + 1)}>&raquo;</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Tab Lịch sử commit ──────────────────────────── */}
          {activeTab === 'commits' && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="fas fa-history mr-1"></i> Lịch sử cập nhật của bạn
                </h3>
              </div>
              <div className="card-body p-0">
                {commitsLoading ? (
                  <div className="text-center py-4"><i className="fas fa-spinner fa-spin fa-2x"></i></div>
                ) : commits.length === 0 ? (
                  <div className="text-center text-muted py-4">Chưa có bản ghi nào</div>
                ) : (
                  <div className="timeline px-3 pt-3">
                    {commits.map(c => (
                      <CommitItem key={c.id} commit={c} />
                    ))}
                  </div>
                )}

                <div className="d-flex justify-content-between align-items-center p-3">
                  <small className="text-muted">Tổng: {commitsTotal} bản ghi</small>
                  <div>
                    <button className="btn btn-sm btn-light mr-1" disabled={commitPage <= 1}
                      onClick={() => setCommitPage(p => p - 1)}>&laquo;</button>
                    <button className="btn btn-sm btn-light" disabled={commits.length < 30}
                      onClick={() => setCommitPage(p => p + 1)}>&raquo;</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ─── Tab Báo cáo hao hụt ─────────────────────────── */}
          {activeTab === 'report' && (
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h3 className="card-title mb-0">
                  <i className="fas fa-chart-bar mr-1"></i> Báo cáo hao hụt
                </h3>
                {reportData && (
                  <button className="btn btn-success btn-sm" onClick={handleExportWord} disabled={exportLoading}>
                    {exportLoading
                      ? <><i className="fas fa-spinner fa-spin mr-1"></i> Đang xuất...</>
                      : <><i className="fas fa-file-word mr-1"></i> Xuất Word (.docx)</>}
                  </button>
                )}
              </div>
              <div className="card-body">
                {/* Bộ lọc */}
                <div className="form-inline mb-4 flex-wrap" style={{ gap: '0.5rem' }}>
                  <label className="mr-1">Từ:</label>
                  <input type="date" className="form-control form-control-sm mr-2"
                    value={reportFrom} onChange={e => setReportFrom(e.target.value)} />
                  <label className="mr-1">Đến:</label>
                  <input type="date" className="form-control form-control-sm mr-2"
                    value={reportTo} onChange={e => setReportTo(e.target.value)} />
                  <select className="form-control form-control-sm mr-2"
                    value={reportGroupBy} onChange={e => setReportGroupBy(e.target.value)}>
                    <option value="month">Theo tháng</option>
                    <option value="day">Theo ngày</option>
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={loadReport} disabled={reportLoading}>
                    {reportLoading
                      ? <><i className="fas fa-spinner fa-spin mr-1"></i> Đang tải...</>
                      : <><i className="fas fa-search mr-1"></i> Xem báo cáo</>}
                  </button>
                </div>

                {reportData && (
                  <>
                    {/* Tóm tắt tổng — 4 thẻ */}
                    <div className="row mb-4">
                      <div className="col-md-3">
                        <div className="info-box bg-danger">
                          <span className="info-box-icon"><i className="fas fa-fish"></i></span>
                          <div className="info-box-content">
                            <span className="info-box-text">Hao hụt cá</span>
                            <span className="info-box-number">{reportData.totalFishLoss} con</span>
                            <span className="progress-description" style={{ fontSize: '0.8rem' }}>
                              {(reportData.totalFishCost || 0).toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="info-box bg-warning">
                          <span className="info-box-icon"><i className="fas fa-tools"></i></span>
                          <div className="info-box-content">
                            <span className="info-box-text">Hao hụt PK/TB</span>
                            <span className="info-box-number">{reportData.totalAccLoss} cái</span>
                            <span className="progress-description" style={{ fontSize: '0.8rem' }}>
                              {(reportData.totalAccCost || 0).toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="info-box bg-danger" style={{ background: '#6f42c1 !important' }}>
                          <span className="info-box-icon" style={{ background: 'rgba(0,0,0,0.15)' }}>
                            <i className="fas fa-money-bill-wave"></i>
                          </span>
                          <div className="info-box-content">
                            <span className="info-box-text">Tổng chi phí hao hụt</span>
                            <span className="info-box-number" style={{ fontSize: '1rem' }}>
                              {(reportData.totalCost || 0).toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-3">
                        <div className="info-box bg-secondary">
                          <span className="info-box-icon"><i className="fas fa-list"></i></span>
                          <div className="info-box-content">
                            <span className="info-box-text">Số lần ghi nhận</span>
                            <span className="info-box-number">{reportData.totalRecords} lần</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bảng theo kỳ */}
                    {reportData.periods.length === 0 ? (
                      <div className="text-center text-muted py-4">Không có dữ liệu hao hụt trong khoảng thời gian này</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-bordered table-hover table-sm">
                          <thead className="thead-dark">
                            <tr>
                              <th>{reportGroupBy === 'day' ? 'Ngày' : 'Tháng'}</th>
                              <th className="text-center text-danger">Hao hụt cá</th>
                              <th className="text-right">Chi phí cá</th>
                              <th className="text-center text-warning">Hao hụt PK/TB</th>
                              <th className="text-right">Chi phí PK/TB</th>
                              <th className="text-right font-weight-bold">Tổng chi phí</th>
                              <th className="text-center" style={{ width: 60 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.periods.map(p => (
                              <React.Fragment key={p.period}>
                                <tr>
                                  <td><strong>{p.period}</strong></td>
                                  <td className="text-center">
                                    {p.fishLoss > 0
                                      ? <span className="badge badge-danger">{p.fishLoss} con</span>
                                      : <span className="text-muted">—</span>}
                                  </td>
                                  <td className="text-right text-muted" style={{ fontSize: '0.9rem' }}>
                                    {p.fishCost > 0 ? (p.fishCost).toLocaleString('vi-VN') + ' đ' : '—'}
                                  </td>
                                  <td className="text-center">
                                    {p.accLoss > 0
                                      ? <span className="badge badge-warning">{p.accLoss} cái</span>
                                      : <span className="text-muted">—</span>}
                                  </td>
                                  <td className="text-right text-muted" style={{ fontSize: '0.9rem' }}>
                                    {p.accCost > 0 ? (p.accCost).toLocaleString('vi-VN') + ' đ' : '—'}
                                  </td>
                                  <td className="text-right">
                                    <strong className="text-danger">
                                      {(p.totalCost || 0).toLocaleString('vi-VN')} đ
                                    </strong>
                                  </td>
                                  <td className="text-center">
                                    <button className="btn btn-xs btn-outline-secondary"
                                      onClick={() => setReportExpanded(prev => ({ ...prev, [p.period]: !prev[p.period] }))}>
                                      <i className={`fas fa-chevron-${reportExpanded[p.period] ? 'up' : 'down'}`}></i>
                                    </button>
                                  </td>
                                </tr>
                                {reportExpanded[p.period] && p.records.map((r, idx) => (
                                  <tr key={idx} style={{ background: '#f8f9fa', fontSize: '0.85rem' }}>
                                    <td className="pl-4 text-muted">
                                      {new Date(r.created).toLocaleString('vi-VN')}
                                    </td>
                                    <td colSpan={2}>
                                      <span className={`badge mr-1 ${r.targetType === 'Fish' ? 'badge-info' : 'badge-secondary'}`}>
                                        {r.targetType === 'Fish' ? 'Cá' : 'PK/TB'}
                                      </span>
                                      <strong>{r.targetName}</strong>
                                      <span className="ml-2 text-danger">-{r.lossAmount}</span>
                                      {r.unitPrice > 0 && (
                                        <span className="ml-2 text-muted">
                                          × {(r.unitPrice).toLocaleString('vi-VN')} đ
                                        </span>
                                      )}
                                    </td>
                                    <td colSpan={2} className="text-muted">
                                      <i>{r.reason || r.commitMessage.split('—')[1]?.trim()}</i>
                                    </td>
                                    <td className="text-right">
                                      {r.totalCost > 0
                                        ? <strong className="text-danger">{(r.totalCost).toLocaleString('vi-VN')} đ</strong>
                                        : <span className="text-muted">—</span>}
                                    </td>
                                    <td className="text-muted text-center">{r.staffName}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                            {/* Dòng tổng cộng */}
                            <tr className="table-active font-weight-bold">
                              <td>TỔNG CỘNG</td>
                              <td className="text-center text-danger">{reportData.totalFishLoss} con</td>
                              <td className="text-right">{(reportData.totalFishCost || 0).toLocaleString('vi-VN')} đ</td>
                              <td className="text-center text-warning">{reportData.totalAccLoss} cái</td>
                              <td className="text-right">{(reportData.totalAccCost || 0).toLocaleString('vi-VN')} đ</td>
                              <td className="text-right text-danger">{(reportData.totalCost || 0).toLocaleString('vi-VN')} đ</td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    <small className="text-muted">
                      <i className="fas fa-info-circle mr-1"></i>
                      Chi phí ước tính dựa trên đơn giá hiện tại của sản phẩm trong hệ thống.
                      Nhấn <i className="fas fa-chevron-down"></i> để xem chi tiết từng lần ghi nhận.
                    </small>
                  </>
                )}

                {!reportData && !reportLoading && (
                  <div className="text-center text-muted py-5">
                    <i className="fas fa-chart-bar fa-3x mb-3 d-block"></i>
                    Chọn khoảng thời gian và nhấn <strong>Xem báo cáo</strong>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ─── Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {modalType === 'tank'
                    ? (editingItem ? 'Cập nhật bể cá' : 'Thêm bể cá mới')
                    : (editingItem ? 'Cập nhật phụ kiện/thiết bị' : 'Thêm phụ kiện/thiết bị mới')}
                </h5>
                <button className="close" onClick={() => setShowModal(false)}>&times;</button>
              </div>
              <div className="modal-body">
                {error && <div className="alert alert-danger">{error}</div>}

                {modalType === 'tank' ? (
                  <TankForm formData={formData} setFormData={setFormData} products={products} />
                ) : (
                  <AccessoryForm formData={formData} setFormData={setFormData} products={accProducts} isEditing={!!editingItem} />
                )}

                <hr />
                <div className="form-group">
                  <label><i className="fas fa-code-branch mr-1 text-secondary"></i> Ghi chú commit <small className="text-muted">(mô tả thay đổi này)</small></label>
                  <input className="form-control" placeholder="VD: Cập nhật sau kiểm kê định kỳ tháng 6..."
                    value={commitMsg} onChange={e => setCommitMsg(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Huỷ</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><i className="fas fa-spinner fa-spin mr-1"></i> Đang lưu...</> : <><i className="fas fa-save mr-1"></i> Lưu</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Loss Modal ─────────────────────────────────────────── */}
      {lossModal.show && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content border-warning">
              <div className="modal-header bg-warning">
                <h5 className="modal-title text-dark">
                  {lossModal.type === 'tank'
                    ? <><i className="fas fa-skull-crossbones mr-2"></i>Ghi nhận cá chết / hao hụt</>
                    : <><i className="fas fa-exclamation-triangle mr-2"></i>Ghi nhận hư hỏng / thất thoát</>}
                </h5>
                <button className="close" onClick={() => setLossModal({ show: false, type: '', item: null })}>&times;</button>
              </div>
              <div className="modal-body">
                {lossError && <div className="alert alert-danger py-2">{lossError}</div>}

                <div className="alert alert-light border mb-3 py-2">
                  <strong>{lossModal.item?.tankName || lossModal.item?.name}</strong>
                  {lossModal.type === 'tank' && (
                    <span className="ml-2 text-muted">
                      (hiện có: {lossModal.item?.maleCount} đực / {lossModal.item?.femaleCount} cái)
                    </span>
                  )}
                  {lossModal.type === 'accessory' && (
                    <span className="ml-2 text-muted">(hiện có: {lossModal.item?.quantity})</span>
                  )}
                </div>

                {lossModal.type === 'tank' ? (
                  <div className="form-row">
                    <div className="form-group col-6">
                      <label>Số cá đực chết</label>
                      <input type="number" min="0" max={lossModal.item?.maleCount}
                        className="form-control"
                        value={lossForm.maleLoss || 0}
                        onChange={e => setLossForm(f => ({ ...f, maleLoss: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group col-6">
                      <label>Số cá cái chết</label>
                      <input type="number" min="0" max={lossModal.item?.femaleCount}
                        className="form-control"
                        value={lossForm.femaleLoss || 0}
                        onChange={e => setLossForm(f => ({ ...f, femaleLoss: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                ) : (
                  <div className="form-row">
                    <div className="form-group col-12">
                      <label>Số lượng hư / mất</label>
                      <input type="number" min="0" max={lossModal.item?.quantity}
                        className="form-control"
                        value={lossForm.quantityLoss || 0}
                        onChange={e => setLossForm(f => ({ ...f, quantityLoss: parseInt(e.target.value) || 0 }))} />
                      <small className="text-muted">Số lượng này sẽ được trừ trực tiếp khỏi tồn kho. Muốn đổi trạng thái, hãy dùng chức năng <strong>Sửa</strong>.</small>
                    </div>
                  </div>
                )}

                <div className="form-group mb-0">
                  <label>Lý do <span className="text-danger">*</span></label>
                  <input className="form-control" value={lossReason}
                    onChange={e => setLossReason(e.target.value)}
                    placeholder="VD: Cá chết do bệnh, thiết bị rơi vỡ, hết hạn sử dụng..." />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary"
                  onClick={() => setLossModal({ show: false, type: '', item: null })}>Huỷ</button>
                <button className="btn btn-warning" onClick={handleLossSave} disabled={lossSaving}>
                  {lossSaving
                    ? <><i className="fas fa-spinner fa-spin mr-1"></i> Đang lưu...</>
                    : <><i className="fas fa-save mr-1"></i> Xác nhận hao hụt</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TankForm({ formData, setFormData, products }) {
  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));
  return (
    <>
      <div className="form-group">
        <label>Loài cá <span className="text-danger">*</span></label>
        <select className="form-control" value={formData.productId || ''}
          onChange={e => set('productId', parseInt(e.target.value))}>
          <option value="">-- Chọn loài cá --</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <small className="text-muted">Tên bể sẽ được lấy từ tên loài cá</small>
      </div>
      <div className="form-row">
        <div className="form-group col-md-4">
          <label>Số cá đực</label>
          <input type="number" min="0" className="form-control" value={formData.maleCount || 0}
            onChange={e => set('maleCount', parseInt(e.target.value) || 0)} />
        </div>
        <div className="form-group col-md-4">
          <label>Số cá cái</label>
          <input type="number" min="0" className="form-control" value={formData.femaleCount || 0}
            onChange={e => set('femaleCount', parseInt(e.target.value) || 0)} />
        </div>
        <div className="form-group col-md-4">
          <label>Tổng</label>
          <input className="form-control bg-light" readOnly
            value={(formData.maleCount || 0) + (formData.femaleCount || 0)} />
        </div>
      </div>
      <div className="form-group">
        <label>Ghi chú bể</label>
        <textarea className="form-control" rows={2} value={formData.notes || ''}
          onChange={e => set('notes', e.target.value)} placeholder="Điều kiện nước, nhiệt độ, ghi chú đặc biệt..." />
      </div>
    </>
  );
}

function AccessoryForm({ formData, setFormData, products, isEditing }) {
  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  return (
    <>
      <div className="form-group">
        <label>Sản phẩm <span className="text-danger">*</span></label>
        <select className="form-control" value={formData.productId || ''}
          onChange={e => set('productId', parseInt(e.target.value) || '')}>
          <option value="">-- Chọn sản phẩm --</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <small className="text-muted">Tên và loại sẽ lấy theo sản phẩm trong danh mục</small>
      </div>
      <div className="form-row">
        <div className="form-group col-md-4">
          <label>Số lượng</label>
          <input type="number" min="0" className="form-control" value={formData.quantity || 0}
            onChange={e => set('quantity', parseInt(e.target.value) || 0)} />
        </div>
        <div className="form-group col-md-4">
          <label>Đơn vị</label>
          <input className="form-control" value={formData.unit || ''}
            onChange={e => set('unit', e.target.value)} placeholder="cái, bộ, kg..." />
        </div>
        <div className="form-group col-md-4">
          <label>Trạng thái</label>
          {isEditing ? (
            <select className="form-control" value={formData.status || 'Good'}
              onChange={e => set('status', e.target.value)}>
              <option value="Good">Tốt</option>
              <option value="Damaged">Hỏng</option>
              <option value="Maintenance">Đang sửa</option>
            </select>
          ) : (
            <input className="form-control bg-light" readOnly value="Tốt (mặc định khi nhập mới)" />
          )}
          {!isEditing && (
            <small className="text-muted">Sản phẩm nhập mới luôn ở trạng thái Tốt. Dùng chức năng <strong>Sửa</strong> để đổi trạng thái.</small>
          )}
        </div>
      </div>
      <div className="form-group">
        <label>Mô tả</label>
        <textarea className="form-control" rows={2} value={formData.description || ''}
          onChange={e => set('description', e.target.value)} />
      </div>
    </>
  );
}

// Đọc số từ JSON hỗ trợ cả camelCase (mới) và PascalCase (cũ)
const getProp = (obj, camel, pascal) => obj?.[camel] ?? obj?.[pascal] ?? 0;
const getStr  = (obj, camel, pascal) => obj?.[camel] ?? obj?.[pascal] ?? '';

function CommitItem({ commit }) {
  const icon    = commit.targetType === 'Fish' ? 'fa-fish text-info' : 'fa-tools text-warning';
  const fmtDate = d => d ? new Date(d).toLocaleString('vi-VN') : '';

  let detail = null;
  try {
    const oldV = commit.oldValue ? JSON.parse(commit.oldValue) : null;
    const newV = commit.newValue ? JSON.parse(commit.newValue) : null;

    if (commit.targetType === 'Fish' && newV) {
      const oldMale   = getProp(oldV, 'maleCount',   'MaleCount');
      const oldFemale = getProp(oldV, 'femaleCount', 'FemaleCount');
      const newMale   = getProp(newV, 'maleCount',   'MaleCount');
      const newFemale = getProp(newV, 'femaleCount', 'FemaleCount');
      const mDiff = newMale   - oldMale;
      const fDiff = newFemale - oldFemale;
      const oldTotal = oldMale + oldFemale;
      const newTotal = newMale + newFemale;
      const totalDiff = newTotal - oldTotal;
      detail = (
        <div className="mt-1 d-flex flex-wrap" style={{ gap: '0.4rem' }}>
          {oldV && (
            <>
              <span className="badge badge-light border">
                Đực: <strong className="text-primary">{oldMale}</strong> → <strong className="text-primary">{newMale}</strong>
                <span className={mDiff >= 0 ? 'text-success ml-1' : 'text-danger ml-1'}>
                  ({mDiff >= 0 ? '+' : ''}{mDiff})
                </span>
              </span>
              <span className="badge badge-light border">
                Cái: <strong className="text-danger">{oldFemale}</strong> → <strong className="text-danger">{newFemale}</strong>
                <span className={fDiff >= 0 ? 'text-success ml-1' : 'text-danger ml-1'}>
                  ({fDiff >= 0 ? '+' : ''}{fDiff})
                </span>
              </span>
              <span className="badge badge-light border">
                Tổng: <strong className="text-success">{oldTotal}</strong> → <strong className="text-success">{newTotal}</strong>
                <span className={totalDiff >= 0 ? 'text-success ml-1' : 'text-danger ml-1'}>
                  ({totalDiff >= 0 ? '+' : ''}{totalDiff})
                </span>
              </span>
            </>
          )}
          {!oldV && (
            <span className="badge badge-light border">
              Đực: <strong className="text-primary">{newMale}</strong> &nbsp;
              Cái: <strong className="text-danger">{newFemale}</strong> &nbsp;
              Tổng: <strong className="text-success">{newTotal}</strong>
            </span>
          )}
        </div>
      );
    } else if (commit.targetType === 'Accessory' && newV) {
      const oldQ = getProp(oldV, 'quantity', 'Quantity');
      const newQ = getProp(newV, 'quantity', 'Quantity');
      const oldS = getStr(oldV,  'status',   'Status');
      const newS = getStr(newV,  'status',   'Status');
      const qDiff = newQ - oldQ;
      const statusChanged = oldS && newS && oldS !== newS;
      detail = (
        <div className="mt-1 d-flex flex-wrap" style={{ gap: '0.4rem' }}>
          <span className="badge badge-light border">
            {oldV
              ? <>SL: <strong>{oldQ}</strong> → <strong>{newQ}</strong>
                  <span className={qDiff >= 0 ? 'text-success ml-1' : 'text-danger ml-1'}>
                    ({qDiff >= 0 ? '+' : ''}{qDiff})
                  </span>
                </>
              : <>SL: <strong>{newQ}</strong></>
            }
          </span>
          {statusChanged && (
            <span className="badge badge-light border">
              Trạng thái: <span className="text-muted">{STATUS_LABELS[oldS] || oldS}</span> → <span className="font-weight-bold">{STATUS_LABELS[newS] || newS}</span>
            </span>
          )}
        </div>
      );
    }
  } catch { /* ignore */ }

  return (
    <div className="d-flex mb-3">
      <div className="mr-3 text-center" style={{ width: 32 }}>
        <i className={`fas ${icon} fa-lg`}></i>
      </div>
      <div className="flex-grow-1 border-left pl-3">
        <div className="d-flex justify-content-between">
          <strong>{commit.targetName}</strong>
          <small className="text-muted">{fmtDate(commit.created)}</small>
        </div>
        <div className="text-dark">{commit.commitMessage}</div>
        {detail}
      </div>
    </div>
  );
}
