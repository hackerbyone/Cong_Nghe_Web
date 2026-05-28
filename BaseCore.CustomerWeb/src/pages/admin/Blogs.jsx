import React, { useState, useEffect, useRef } from 'react';
import { blogService } from '../../services/blog/blogService';
import { uploadService } from '../../services/upload/uploadService';
import { useAuth } from '../../context/AuthContext';

const Blogs = () => {
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingBlog, setEditingBlog] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(5);
    const [formData, setFormData] = useState({
        title: '',
        shortDescription: '',
        content: '',
        imageUrl: '',
        author: '',
        isActive: true
    });
    const [error, setError] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const { isAdmin } = useAuth();

    // FIX 5: dùng ref cho textarea content để hỗ trợ paste
    const contentRef = useRef(null);
    const shortDescRef = useRef(null);

    useEffect(() => { loadBlogs(); }, []);

    // FIX 5: sync ref value khi formData thay đổi (khi mở modal edit)
    useEffect(() => {
        if (showModal) {
            if (contentRef.current) contentRef.current.value = formData.content;
            if (shortDescRef.current) shortDescRef.current.value = formData.shortDescription;
        }
    }, [showModal, editingBlog]);

    const loadBlogs = async () => {
        setLoading(true);
        try {
            const response = await blogService.getAll();
            const list = Array.isArray(response)
                ? response
                : response.items ?? response.data?.items ?? response.data ?? response.records ?? [];
            setBlogs(list);
        } catch (error) {
            console.error('Lỗi khi tải danh sách blog:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (blog = null) => {
        if (blog) {
            setEditingBlog(blog);
            setFormData({
                title: blog.title || '',
                shortDescription: blog.shortDescription || '',
                content: blog.content || '',
                imageUrl: blog.imageUrl || '',
                author: blog.author || '',
                isActive: blog.isActive !== undefined ? blog.isActive : true
            });
        } else {
            setEditingBlog(null);
            setFormData({ title: '', shortDescription: '', content: '', imageUrl: '', author: '', isActive: true });
        }
        setError('');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingBlog(null);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        // FIX 5: lấy value trực tiếp từ ref khi submit
        const submitData = {
            ...formData,
            content: contentRef.current?.value ?? formData.content,
            shortDescription: shortDescRef.current?.value ?? formData.shortDescription,
        };
        try {
            if (editingBlog) {
                await blogService.update(editingBlog.id, submitData);
            } else {
                await blogService.create(submitData);
            }
            closeModal();
            loadBlogs();
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
        if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này?')) return;
        try {
            await blogService.delete(id);
            loadBlogs();
        } catch (error) {
            alert('Xóa bài viết thất bại.');
        }
    };

    const filteredBlogs = blogs.filter(blog => {
        const query = searchQuery.toLowerCase();
        return (
            blog.title.toLowerCase().includes(query) ||
            (blog.author && blog.author.toLowerCase().includes(query)) ||
            (blog.shortDescription && blog.shortDescription.toLowerCase().includes(query))
        );
    });

    const totalPages = Math.ceil(filteredBlogs.length / itemsPerPage);
    const indexOfLastBlog = currentPage * itemsPerPage;
    const indexOfFirstBlog = indexOfLastBlog - itemsPerPage;
    const currentBlogs = filteredBlogs.slice(indexOfFirstBlog, indexOfLastBlog);

    const handleSearchChange = (e) => { setSearchQuery(e.target.value); setCurrentPage(1); };
    const handleClearSearch = () => { setSearchQuery(''); setCurrentPage(1); };
    const goToPage = (n) => setCurrentPage(Math.max(1, Math.min(n, totalPages)));

    return (
        <>
            <div className="content-header">
                <div className="container-fluid">
                    <div className="row mb-2">
                        <div className="col-sm-6">
                            <h1 className="m-0"><i className="fas fa-blog mr-2"></i>Quản lý Bài viết</h1>
                        </div>
                        <div className="col-sm-6">
                            <ol className="breadcrumb float-sm-right">
                                <li className="breadcrumb-item"><a href="#">Trang chủ</a></li>
                                <li className="breadcrumb-item active">Blog</li>
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
                                <div className="col-md-6">
                                    <h3 className="card-title m-0"><i className="fas fa-list mr-2"></i>Danh sách bài viết</h3>
                                </div>
                                <div className="col-md-6 text-right">
                                    {isAdmin() && (
                                        <button className="btn btn-success btn-sm" onClick={() => openModal()}>
                                            <i className="fas fa-plus mr-1"></i> Thêm bài viết
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="card-body">
                            <div className="row mb-3">
                                <div className="col-md-8">
                                    <div className="input-group">
                                        <input
                                            type="text" className="form-control"
                                            placeholder="Tìm kiếm theo tiêu đề, tác giả..."
                                            value={searchQuery} onChange={handleSearchChange}
                                        />
                                        <div className="input-group-append">
                                            <button className="btn btn-outline-secondary" type="button" onClick={handleClearSearch}>
                                                <i className="fas fa-times"></i> Xóa
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4 text-right text-muted">
                                    Tìm thấy: <strong>{filteredBlogs.length}</strong> bài viết
                                </div>
                            </div>

                            {loading ? (
                                <div className="text-center py-4"><div className="spinner-border text-primary"></div></div>
                            ) : (
                                <table className="table table-bordered table-striped">
                                    <thead className="text-center">
                                        <tr>
                                            <th style={{ width: 60 }}>ID</th>
                                            <th style={{ width: 100 }}>Hình ảnh</th>
                                            <th>Tiêu đề</th>
                                            <th>Tác giả</th>
                                            {isAdmin() && <th style={{ width: 120 }}>Thao tác</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="text-center align-middle">
                                        {currentBlogs.length === 0 ? (
                                            <tr><td colSpan={isAdmin() ? 5 : 4}>{searchQuery ? 'Không tìm thấy bài viết nào' : 'Chưa có bài viết nào'}</td></tr>
                                        ) : (
                                            currentBlogs.map(blog => (
                                                <tr key={blog.id}>
                                                    <td>{blog.id}</td>
                                                    <td>
                                                        {blog.imageUrl ? (
                                                            <img src={blog.imageUrl} alt={blog.title}
                                                                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                                                                onError={e => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect fill="%23e0e0e0" width="60" height="60"/%3E%3C/svg%3E' }}
                                                            />
                                                        ) : <span className="text-muted">Không có ảnh</span>}
                                                    </td>
                                                    <td className="text-left font-weight-bold">{blog.title}</td>
                                                    <td className="text-left">{blog.author || 'N/A'}</td>
                                                    {isAdmin() && (
                                                        <td>
                                                            <button className="btn btn-sm btn-info mr-1" onClick={() => openModal(blog)}><i className="fas fa-edit"></i></button>
                                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(blog.id)}><i className="fas fa-trash"></i></button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}

                            {!loading && filteredBlogs.length > 0 && (
                                <nav className="d-flex justify-content-between align-items-center mt-4 flex-wrap">
                                    <div className="text-muted small mb-2 mb-md-0">
                                        Trang {currentPage} / {totalPages} • Hiển thị {indexOfFirstBlog + 1}-{Math.min(indexOfLastBlog, filteredBlogs.length)} trên {filteredBlogs.length}
                                    </div>
                                    {totalPages > 1 && (
                                        <ul className="pagination mb-0">
                                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => goToPage(currentPage - 1)}>Trước</button>
                                            </li>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                                <li key={n} className={`page-item ${currentPage === n ? 'active' : ''}`}>
                                                    <button className="page-link" onClick={() => goToPage(n)}>{n}</button>
                                                </li>
                                            ))}
                                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => goToPage(currentPage + 1)}>Sau</button>
                                            </li>
                                        </ul>
                                    )}
                                </nav>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Modal */}
            {showModal && (
                <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">
                                    <i className={`fas fa-${editingBlog ? 'edit' : 'plus'} mr-2`}></i>
                                    {editingBlog ? 'Chỉnh sửa bài viết' : 'Thêm bài viết mới'}
                                </h5>
                                <button type="button" className="close text-white" onClick={closeModal}><span>&times;</span></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body text-dark">
                                    {error && <div className="alert alert-danger">{error}</div>}

                                    <div className="form-group">
                                        <label>Tiêu đề bài viết <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                                    </div>

                                    <div className="form-group">
                                        <label>Mô tả ngắn</label>
                                        {/* FIX 5: dùng ref, không dùng value controlled để paste hoạt động */}
                                        <textarea
                                            ref={shortDescRef}
                                            className="form-control" rows="2"
                                            defaultValue={formData.shortDescription}
                                            placeholder="Mô tả ngắn hiển thị ngoài danh sách..."
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Tác giả</label>
                                        <input type="text" className="form-control" value={formData.author}
                                            onChange={e => setFormData({ ...formData, author: e.target.value })} />
                                    </div>

                                    <div className="form-group">
                                        <label>Hình ảnh</label>
                                        {formData.imageUrl && (
                                            <div className="mb-2 text-center">
                                                <img src={formData.imageUrl} alt="Preview"
                                                    style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 6, border: '1px solid #dee2e6', objectFit: 'contain' }}
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                        )}
                                        <input type="text" className="form-control mb-2"
                                            value={formData.imageUrl}
                                            onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                            placeholder="Nhập link hình ảnh (https://...)"
                                        />
                                        <div className="d-flex align-items-center">
                                            <label className={`btn btn-outline-secondary btn-sm mb-0 ${uploadingImage ? 'disabled' : ''}`}>
                                                {uploadingImage
                                                    ? <><span className="spinner-border spinner-border-sm mr-1"></span>Đang tải...</>
                                                    : <><i className="fas fa-upload mr-1"></i>Chọn ảnh từ máy</>
                                                }
                                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploadingImage} />
                                            </label>
                                            {formData.imageUrl && (
                                                <button type="button" className="btn btn-outline-danger btn-sm ml-2"
                                                    onClick={() => setFormData({ ...formData, imageUrl: '' })}>
                                                    <i className="fas fa-times mr-1"></i>Xóa ảnh
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Nội dung chi tiết <span className="text-danger">*</span></label>
                                        {/* FIX 5: dùng ref + defaultValue để paste/ctrl+v hoạt động bình thường */}
                                        <textarea
                                            ref={contentRef}
                                            className="form-control" rows="8"
                                            defaultValue={formData.content}
                                            placeholder="Nhập nội dung bài viết... (hỗ trợ dán văn bản Ctrl+V)"
                                            required
                                        />
                                        <small className="text-muted">Có thể dán văn bản (Ctrl+V / Cmd+V) trực tiếp vào ô này.</small>
                                    </div>

                                    <div className="form-group form-check">
                                        <input type="checkbox" className="form-check-input" id="isActiveCheck"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                                        <label className="form-check-label" htmlFor="isActiveCheck">Hiển thị bài viết (IsActive)</label>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                        <i className="fas fa-times mr-1"></i> Hủy
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        <i className={`fas fa-${editingBlog ? 'save' : 'plus'} mr-1`}></i>
                                        {editingBlog ? 'Cập nhật' : 'Lưu bài viết'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {showModal && <div className="modal-backdrop fade show"></div>}
        </>
    );
};

export default Blogs;