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
        tempMin: '',
        tempMax: '',
        phMin: '',
        phMax: '',
        hardness: '',
        maxSize: '',
        diet: '',
        compatibility: '',
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

    const getProductCategoryName = (product) => {
        if (product.categoryName) return product.categoryName;
        if (product.category?.name) return product.category.name;

        const category = categories.find(cat => String(cat.id) === String(product.categoryId));
        return category?.name || 'Chưa phân loại';
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
                tempMin: product.tempMin ?? '',
                tempMax: product.tempMax ?? '',
                phMin: product.phMin ?? '',
                phMax: product.phMax ?? '',
                hardness: product.hardness || '',
                maxSize: product.maxSize || '',
                diet: product.diet || '',
                compatibility: product.compatibility || '',
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
                tempMin: '',
                tempMax: '',
                phMin: '',
                phMax: '',
                hardness: '',
                maxSize: '',
                diet: '',
                compatibility: '',
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
                stock: isGenderProduct ? genderTotal : stock,
                categoryId: parseInt(formData.categoryId),
                maleStock,
                femaleStock,
                tempMin: formData.tempMin !== '' ? parseFloat(formData.tempMin) : null,
                tempMax: formData.tempMax !== '' ? parseFloat(formData.tempMax) : null,
                phMin: formData.phMin !== '' ? parseFloat(formData.phMin) : null,
                phMax: formData.phMax !== '' ? parseFloat(formData.phMax) : null,
                hardness: formData.hardness || null,
                maxSize: formData.maxSize || null,
                diet: formData.diet || null,
                compatibility: formData.compatibility || null,
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
                                    {products.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fas fa-box-open fa-3x mb-3 d-block"></i>
                                            Không tìm thấy sản phẩm nào
                                        </div>
                                    ) : (
                                        <div className="row">
                                            {products.map(product => (
                                                <div key={product.id} className="col-xl-3 col-lg-4 col-md-6 col-sm-6 mb-4">
                                                    <div className="card h-100 shadow-sm" style={{ border: '1px solid #e0eaf3', borderRadius: '10px', overflow: 'hidden' }}>
                                                        <div style={{ position: 'relative', height: '180px', background: '#f0f6fb', overflow: 'hidden' }}>
                                                            {product.imageUrl ? (
                                                                <img
                                                                    src={product.imageUrl}
                                                                    alt={product.name}
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <i className="fas fa-image text-muted" style={{ fontSize: '2.5rem' }}></i>
                                                                </div>
                                                            )}
                                                            <span
                                                                className={`badge ${product.stock > 10 ? 'badge-success' : product.stock > 0 ? 'badge-warning' : 'badge-danger'}`}
                                                                style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '0.75rem' }}
                                                            >
                                                                Kho: {product.stock}
                                                            </span>
                                                            <span
                                                                className="badge badge-secondary"
                                                                style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '0.7rem', opacity: 0.8 }}
                                                            >
                                                                #{product.id}
                                                            </span>
                                                        </div>
                                                        <div className="card-body d-flex flex-column p-3">
                                                            <h6 className="card-title mb-1" style={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.3, minHeight: '2.4em' }}>
                                                                {product.name}
                                                            </h6>
                                                            <div className="mb-2">
                                                                <span className="badge badge-light" style={{ background: '#e8f4fd', color: '#3d8bc2', border: '1px solid #a8d5f0', fontSize: '0.73rem' }}>
                                                                    {getProductCategoryName(product)}
                                                                </span>
                                                            </div>
                                                            <div className="mt-auto">
                                                                <div style={{ fontWeight: 700, color: '#dc3545', fontSize: '1rem' }}>
                                                                    {product.price?.toLocaleString('vi-VN')} đ
                                                                </div>
                                                                {isAdmin() && (
                                                                    <div className="d-flex mt-2" style={{ gap: '6px' }}>
                                                                        <button
                                                                            className="btn btn-warning btn-sm flex-fill"
                                                                            onClick={() => openModal(product)}
                                                                            title="Chỉnh sửa"
                                                                        >
                                                                            <i className="fas fa-edit mr-1"></i>Sửa
                                                                        </button>
                                                                        <button
                                                                            className="btn btn-danger btn-sm flex-fill"
                                                                            onClick={() => handleDelete(product.id)}
                                                                            title="Xóa"
                                                                        >
                                                                            <i className="fas fa-trash mr-1"></i>Xóa
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

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
                                    <div className="card card-body bg-light mb-3 p-3">
                                        <h6 className="mb-3" style={{ borderBottom: '1px solid #dee2e6', paddingBottom: '0.5rem' }}>
                                            <i className="fas fa-flask mr-1 text-info"></i> Thông số sinh học (chỉ áp dụng cho cá)
                                        </h6>
                                        <div className="row">
                                            <div className="col-6">
                                                <div className="form-group mb-2">
                                                    <label className="small mb-1">🌡️ Nhiệt độ min (°C)</label>
                                                    <input type="number" step="0.1" className="form-control form-control-sm" value={formData.tempMin}
                                                        onChange={e => setFormData({ ...formData, tempMin: e.target.value })} placeholder="VD: 24" />
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="form-group mb-2">
                                                    <label className="small mb-1">🌡️ Nhiệt độ max (°C)</label>
                                                    <input type="number" step="0.1" className="form-control form-control-sm" value={formData.tempMax}
                                                        onChange={e => setFormData({ ...formData, tempMax: e.target.value })} placeholder="VD: 28" />
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="form-group mb-2">
                                                    <label className="small mb-1">🧪 pH min</label>
                                                    <input type="number" step="0.1" className="form-control form-control-sm" value={formData.phMin}
                                                        onChange={e => setFormData({ ...formData, phMin: e.target.value })} placeholder="VD: 6.5" />
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="form-group mb-2">
                                                    <label className="small mb-1">🧪 pH max</label>
                                                    <input type="number" step="0.1" className="form-control form-control-sm" value={formData.phMax}
                                                        onChange={e => setFormData({ ...formData, phMax: e.target.value })} placeholder="VD: 7.5" />
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="form-group mb-2">
                                                    <label className="small mb-1">💧 Độ cứng (dH)</label>
                                                    <input type="text" className="form-control form-control-sm" value={formData.hardness}
                                                        onChange={e => setFormData({ ...formData, hardness: e.target.value })} placeholder="VD: 5-15 dH" />
                                                </div>
                                            </div>
                                            <div className="col-6">
                                                <div className="form-group mb-2">
                                                    <label className="small mb-1">📏 Kích thước tối đa</label>
                                                    <input type="text" className="form-control form-control-sm" value={formData.maxSize}
                                                        onChange={e => setFormData({ ...formData, maxSize: e.target.value })} placeholder="VD: 8 cm" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="form-group mb-2">
                                            <label className="small mb-1">🍤 Chế độ ăn</label>
                                            <textarea className="form-control form-control-sm" rows="2" value={formData.diet}
                                                onChange={e => setFormData({ ...formData, diet: e.target.value })} placeholder="VD: Ăn tạp, thức ăn viên, tôm, giun..." />
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="small mb-1">🐟 Nuôi chung / Tính tương thích</label>
                                            <textarea className="form-control form-control-sm" rows="2" value={formData.compatibility}
                                                onChange={e => setFormData({ ...formData, compatibility: e.target.value })} placeholder="VD: Có thể nuôi chung cá hiền. Không nuôi với cá đuôi dài vì hay rỉa vây..." />
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
