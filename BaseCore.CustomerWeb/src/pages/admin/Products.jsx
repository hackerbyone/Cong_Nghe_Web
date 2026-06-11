import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { productService } from '../../services/product/productService'; 
import { categoryService } from '../../services/category/categoryService';
import { uploadService } from '../../services/upload/uploadService';
import { useAuth } from '../../context/AuthContext';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        price: 0,
        stock: 0,
        description: '',
        careInstructions: '',
        environment: '',
        maleStock: 0,
        femaleStock: 0,
        imageUrl: '',
        categoryId: '',
    });
    const [error, setError] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const { isAdmin } = useAuth();

    useEffect(() => {
        loadCategories();
    }, []);

    useEffect(() => {
        loadProducts();
    }, [page, keyword, categoryId]);

    const loadCategories = async () => {
        try {
            const response = await categoryService.getAll();
            setCategories(response || []);
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    const loadProducts = async () => {
        setLoading(true);
        try {
            const response = await productService.getAll(
                keyword,
                categoryId || null,
                page,
                pageSize
            );
            setProducts(response.items || []);
            setTotalPages(response.totalPages || Math.ceil((response.totalCount || 0) / pageSize));
            setTotalCount(response.totalCount || 0);
        } catch (error) {
            console.error('Failed to load products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        loadProducts();
    };

    const openModal = (product = null) => {
        document.body.classList.add('modal-open');
        if (product) {
            setEditingProduct(product);
            setFormData({
                name: product.name,
                price: product.price,
                stock: product.stock,
                description: product.description || '',
                careInstructions: product.careInstructions || '',
                environment: product.environment || '',
                maleStock: product.maleStock ?? 0,
                femaleStock: product.femaleStock ?? 0,
                imageUrl: product.imageUrl || '',
                categoryId: product.categoryId,
            });
        } else {
            setEditingProduct(null);
            setFormData({
                name: '',
                price: 0,
                stock: 0,
                description: '',
                careInstructions: '',
                environment: '',
                maleStock: 0,
                femaleStock: 0,
                imageUrl: '',
                categoryId: categories[0]?.id || '',
            });
        }
        setError('');
        setShowModal(true);
    };

    const closeModal = () => {
        document.body.classList.remove('modal-open');
        setShowModal(false);
        setEditingProduct(null);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const maleStock = parseInt(formData.maleStock) || 0;
        const femaleStock = parseInt(formData.femaleStock) || 0;
        const stock = parseInt(formData.stock) || 0;
        const genderTotal = maleStock + femaleStock;
        const isGenderProduct = maleStock > 0 || femaleStock > 0;

        // Validation: khi dùng gender, tổng đực + cái phải BẰNG tổng kho (nếu stock > 0)
        if (isGenderProduct && stock > 0 && stock !== genderTotal) {
            const diff = stock - genderTotal;
            setError(
                diff > 0
                    ? `Tổng kho (${stock}) lớn hơn đực (${maleStock}) + cái (${femaleStock}) = ${genderTotal}. Đang dư ${diff} con chưa phân giới tính. Hãy điều chỉnh lại.`
                    : `Tổng kho (${stock}) nhỏ hơn đực (${maleStock}) + cái (${femaleStock}) = ${genderTotal}. Đang thiếu ${-diff} con. Hãy điều chỉnh lại.`
            );
            return;
        }

        try {
            const data = {
                ...formData,
                price: parseFloat(formData.price),
                // Khi dùng gender: stock = tổng gender (auto-sync, không phụ thuộc ô nhập)
                stock: isGenderProduct ? genderTotal : stock,
                categoryId: parseInt(formData.categoryId),
                maleStock,
                femaleStock,
            };
            if (editingProduct) {
                await productService.update(editingProduct.id, data);
            } else {
                await productService.create(data);
            }
            closeModal();
            loadProducts();
        } catch (error) {
            setError(error.message || 'Thao tác thất bại');
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingImage(true);
        setError('');
        try {
            const result = await uploadService.uploadImage(file);
            setFormData(prev => ({ ...prev, imageUrl: result.url }));
        } catch (err) {
            setError('Tải ảnh thất bại: ' + err.message);
        } finally {
            setUploadingImage(false);
            e.target.value = '';
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;
        try {
            await productService.delete(id);
            loadProducts();
        } catch (error) {
            alert('Xóa sản phẩm thất bại');
        }
    };

    const renderPagination = () => {
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push(
                <li key={i} className={`page-item ${page === i ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setPage(i)}>{i}</button>
                </li>
            );
        }
        return pages;
    };

    return (
        <>
            <div className="content-header">
                <div className="container-fluid">
                    <div className="row mb-2">
                        <div className="col-sm-6">
                            <h1 className="m-0">
                                <i className="fas fa-box mr-2"></i>Quản lý Sản phẩm
                            </h1>
                        </div>
                        <div className="col-sm-6">
                            <ol className="breadcrumb float-sm-right">
                                <li className="breadcrumb-item"><a href="#">Trang chủ</a></li>
                                <li className="breadcrumb-item active">Sản phẩm</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>

            <section className="content">
                <div className="container-fluid">
                    <div className="card card-primary">
                        <div className="card-header">
                            <div className="row align-items-center">
                                <div className="col-md-7">
                                    <form onSubmit={handleSearch} className="form-inline">
                                        <div className="input-group input-group-sm mr-2" style={{ width: '220px' }}>
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Tìm kiếm sản phẩm..."
                                                value={keyword}
                                                onChange={(e) => setKeyword(e.target.value)}
                                            />
                                            <div className="input-group-append">
                                                <button type="submit" className="btn btn-navbar">
                                                    <i className="fas fa-search"></i>
                                                </button>
                                            </div>
                                        </div>
                                        <select
                                            className="form-control form-control-sm"
                                            style={{ width: '160px' }}
                                            value={categoryId}
                                            onChange={(e) => setCategoryId(e.target.value)}
                                        >
                                            <option value="">Tất cả danh mục</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </form>
                                </div>
                                <div className="col-md-5 text-right">
                                    {isAdmin() && (
                                        <button className="btn btn-success btn-sm" onClick={() => openModal()}>
                                            <i className="fas fa-plus mr-1"></i> Thêm sản phẩm
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            {loading ? (
                                <div className="text-center py-5">
                                    <div className="spinner-border text-primary" role="status"></div>
                                    <p className="text-muted mt-2">Đang tải danh sách sản phẩm...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="table-responsive">
                                        <table className="table table-bordered table-striped table-hover table-sm">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '60px' }}>Ảnh</th>
                                                    <th style={{ width: '60px' }}>ID</th>
                                                    <th>Tên sản phẩm</th>
                                                    <th>Danh mục</th>
                                                    <th>Giá</th>
                                                    <th>Kho</th>
                                                    {isAdmin() && <th style={{ width: '90px' }}>Thao tác</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {products.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={isAdmin() ? 7 : 6} className="text-center py-4 text-muted">
                                                            <i className="fas fa-box-open fa-2x mb-2 d-block"></i>
                                                            Không tìm thấy sản phẩm nào
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    products.map(product => (
                                                        <tr key={product.id}>
                                                            <td className="text-center">
                                                                {product.imageUrl ? (
                                                                    <img
                                                                        src={product.imageUrl}
                                                                        alt={product.name}
                                                                        style={{
                                                                            width: '46px',
                                                                            height: '46px',
                                                                            objectFit: 'cover',
                                                                            borderRadius: '6px',
                                                                            border: '1px solid #e0eaf3'
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div style={{
                                                                        width: '46px', height: '46px',
                                                                        background: '#e8f4fd',
                                                                        borderRadius: '6px',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        margin: '0 auto'
                                                                    }}>
                                                                        <i className="fas fa-image text-muted" style={{ fontSize: '1rem' }}></i>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="text-muted">{product.id}</td>
                                                            <td><strong>{product.name}</strong></td>
                                                            <td>
                                                                <span className="badge badge-light" style={{ background: '#e8f4fd', color: '#3d8bc2', border: '1px solid #a8d5f0' }}>
                                                                    {product.category?.name || 'N/A'}
                                                                </span>
                                                            </td>
                                                            <td className="font-weight-bold text-danger">
                                                                {product.price?.toLocaleString('vi-VN')} đ
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${product.stock > 10 ? 'badge-success' : product.stock > 0 ? 'badge-warning' : 'badge-danger'}`}>
                                                                    {product.stock}
                                                                </span>
                                                            </td>
                                                            {isAdmin() && (
                                                                <td>
                                                                    <button
                                                                        className="btn btn-xs btn-warning mr-1"
                                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                                        onClick={() => openModal(product)}
                                                                        title="Chỉnh sửa"
                                                                    >
                                                                        <i className="fas fa-edit"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-xs btn-danger"
                                                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                                        onClick={() => handleDelete(product.id)}
                                                                        title="Xóa"
                                                                    >
                                                                        <i className="fas fa-trash"></i>
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="d-flex justify-content-between align-items-center mt-3">
                                        <span className="text-muted">
                                            <strong>Tổng cộng:</strong> {totalCount} sản phẩm
                                        </span>
                                        <nav>
                                            <ul className="pagination pagination-sm mb-0">
                                                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                                                    <button className="page-link" onClick={() => setPage(page - 1)} disabled={page === 1}>
                                                        Trước
                                                    </button>
                                                </li>
                                                {renderPagination()}
                                                <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                                                    <button className="page-link" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                                                        Sau
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Modal Thêm/Sửa */}
            {showModal && createPortal(
                <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
                    <div className="modal-dialog modal-lg modal-dialog-scrollable">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    <i className={`fas fa-${editingProduct ? 'edit' : 'plus'} mr-2`}></i>
                                    {editingProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
                                </h5>
                                <button type="button" className="close text-white" onClick={closeModal}>
                                    <span>&times;</span>
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
                                <div className="modal-body" style={{ overflowY: 'auto' }}>
                                    {error && (
                                        <div className="alert alert-danger">
                                            <i className="fas fa-exclamation-circle mr-2"></i>{error}
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label>
                                            <i className="fas fa-box mr-1 text-primary"></i>
                                            Tên sản phẩm <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="Nhập tên sản phẩm..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <i className="fas fa-tags mr-1 text-primary"></i>
                                            Danh mục <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className="form-control"
                                            value={formData.categoryId}
                                            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Chọn danh mục --</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label>
                                                    <i className="fas fa-money-bill mr-1 text-primary"></i>
                                                    Giá (VNĐ) <span className="text-danger">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={formData.price}
                                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                    required
                                                    min="0"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label>
                                                    <i className="fas fa-warehouse mr-1 text-primary"></i>
                                                    Số lượng kho <span className="text-danger">*</span>
                                                </label>
                                                {(() => {
                                                    const m = parseInt(formData.maleStock) || 0;
                                                    const f = parseInt(formData.femaleStock) || 0;
                                                    const isGender = m > 0 || f > 0;
                                                    if (isGender) {
                                                        return (
                                                            <div className="input-group">
                                                                <input
                                                                    type="number"
                                                                    className="form-control bg-light"
                                                                    value={m + f}
                                                                    readOnly
                                                                    tabIndex={-1}
                                                                />
                                                                <div className="input-group-append">
                                                                    <span className="input-group-text text-success" style={{ fontSize: '0.8rem' }}>
                                                                        ♂{m} + ♀{f}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            value={formData.stock}
                                                            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                                            required
                                                            min="0"
                                                            placeholder="0"
                                                        />
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <i className="fas fa-image mr-1 text-primary"></i>
                                            Hình ảnh
                                        </label>
                                        {formData.imageUrl && (
                                            <div className="mb-2 text-center">
                                                <img
                                                    src={formData.imageUrl}
                                                    alt="Preview"
                                                    style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '6px', border: '1px solid #dee2e6', objectFit: 'contain' }}
                                                    onError={(e) => { e.target.style.display = 'none'; }}
                                                    onLoad={(e) => { e.target.style.display = 'inline'; }}
                                                />
                                            </div>
                                        )}
                                        <input
                                            type="text"
                                            className="form-control mb-2"
                                            value={formData.imageUrl}
                                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                            placeholder="Nhập link hình ảnh (https://...)"
                                        />
                                        <div className="d-flex align-items-center mb-2">
                                            <hr style={{ flex: 1, margin: 0 }} />
                                            <span className="px-2 text-muted small">hoặc tải ảnh lên</span>
                                            <hr style={{ flex: 1, margin: 0 }} />
                                        </div>
                                        <div className="d-flex align-items-center">
                                            <label className={`btn btn-outline-secondary btn-sm mb-0 ${uploadingImage ? 'disabled' : ''}`} style={{ cursor: uploadingImage ? 'not-allowed' : 'pointer' }}>
                                                {uploadingImage ? (
                                                    <><span className="spinner-border spinner-border-sm mr-1" role="status"></span>Đang tải...</>
                                                ) : (
                                                    <><i className="fas fa-upload mr-1"></i>Chọn ảnh từ máy</>
                                                )}
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={handleImageUpload}
                                                    disabled={uploadingImage}
                                                />
                                            </label>
                                            {formData.imageUrl && (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger btn-sm ml-2"
                                                    onClick={() => setFormData({ ...formData, imageUrl: '' })}
                                                >
                                                    <i className="fas fa-times mr-1"></i>Xóa ảnh
                                                </button>
                                            )}
                                        </div>
                                        <small className="text-muted">Hỗ trợ: jpg, png, gif, webp. Tối đa 5MB.</small>
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <i className="fas fa-align-left mr-1 text-primary"></i>
                                            Mô tả
                                        </label>
                                        <textarea
                                            className="form-control"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows="3"
                                            placeholder="Nhập mô tả sản phẩm..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <i className="fas fa-hand-holding-water mr-1 text-primary"></i>
                                            Cách chăm sóc
                                        </label>
                                        <textarea
                                            className="form-control"
                                            value={formData.careInstructions}
                                            onChange={(e) => setFormData({ ...formData, careInstructions: e.target.value })}
                                            rows="3"
                                            placeholder="Hướng dẫn chăm sóc cá..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <i className="fas fa-water mr-1 text-primary"></i>
                                            Môi trường sống
                                        </label>
                                        <textarea
                                            className="form-control"
                                            value={formData.environment}
                                            onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                                            rows="2"
                                            placeholder="Nhiệt độ, pH, độ cứng nước..."
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <i className="fas fa-venus-mars mr-1 text-primary"></i>
                                            Tồn kho theo giới tính
                                        </label>
                                        <small className="text-muted d-block mb-2">
                                            Nhập số lượng từng giới tính. Để 0 nếu sản phẩm không phân giới tính.
                                        </small>
                                        <div className="row">
                                            <div className="col-6">
                                                <div className="input-group input-group-sm">
                                                    <div className="input-group-prepend">
                                                        <span className="input-group-text" style={{ background: '#e3f2fd', color: '#1565c0' }}>♂ Đực</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        value={formData.maleStock}
                                                        onChange={(e) => setFormData({ ...formData, maleStock: e.target.value })}
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="input-group input-group-sm">
                                                    <div className="input-group-prepend">
                                                        <span className="input-group-text" style={{ background: '#fce4ec', color: '#c62828' }}>♀ Cái</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        value={formData.femaleStock}
                                                        onChange={(e) => setFormData({ ...formData, femaleStock: e.target.value })}
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        {(() => {
                                            const m = parseInt(formData.maleStock) || 0;
                                            const f = parseInt(formData.femaleStock) || 0;
                                            const s = parseInt(formData.stock) || 0;
                                            const total = m + f;
                                            const isGender = m > 0 || f > 0;
                                            if (!isGender) return null;
                                            const overStock = s > 0 && total > s;
                                            return (
                                                <div className={`mt-2 p-2 rounded small ${overStock ? 'alert alert-danger mb-0 py-1' : 'alert alert-info mb-0 py-1'}`}>
                                                    {overStock
                                                        ? <>⚠️ Tổng đực ({m}) + cái ({f}) = <strong>{total}</strong> con, vượt quá tổng kho ({s} con)</>
                                                        : <>ℹ️ Tổng tồn kho tự động: {m > 0 ? `${m} đực` : ''}{m > 0 && f > 0 ? ' + ' : ''}{f > 0 ? `${f} cái` : ''} = <strong>{total}</strong> con{m > 0 && f > 0 ? '. Khách có thể chọn đực / cái / cặp đôi.' : '.'}</>
                                                    }
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        <i className="fas fa-times mr-1"></i> Hủy
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        <i className={`fas fa-${editingProduct ? 'save' : 'plus'} mr-1`}></i>
                                        {editingProduct ? 'Cập nhật' : 'Tạo mới'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {showModal && createPortal(
                <div className="modal-backdrop fade show"></div>,
                document.body
            )}
        </>
    );
};

export default Products;
