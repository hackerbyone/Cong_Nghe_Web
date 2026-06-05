import { buildUrl, getHeaders, handleResponse } from '../utils/apiClient';

export const productService = {
  getAll: async (keyword = '', categoryId = null, page = 1, pageSize = 12, minPrice = null, maxPrice = null, sortBy = null) => {
    const params = {};
    if (keyword) params.keyword = keyword;
    if (categoryId) params.categoryId = categoryId;
    params.page = page;
    params.pageSize = pageSize;
    if (minPrice != null && minPrice > 0) params.minPrice = minPrice;
    if (maxPrice != null && maxPrice > 0) params.maxPrice = maxPrice;
    if (sortBy && sortBy !== 'default' && sortBy !== 'rating') params.sortBy = sortBy;

    const response = await fetch(buildUrl('/api/products', params), {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch products');
  },

  getById: async (id) => {
    const response = await fetch(buildUrl(`/api/products/${id}`), {
      method: 'GET',
      headers: getHeaders(),
    });
    return handleResponse(response, 'Failed to fetch product');
  },

  create: async (productData) => {
    const response = await fetch(buildUrl('/api/products'), {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(productData),
    });
    return handleResponse(response, 'Failed to create product');
  },

  update: async (id, productData) => {
    const response = await fetch(buildUrl(`/api/products/${id}`), {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(productData),
    });
    return handleResponse(response, 'Failed to update product');
  },

  delete: async (id) => {
    const response = await fetch(buildUrl(`/api/products/${id}`), {
      method: 'DELETE',
      headers: getHeaders(true),
    });
    return handleResponse(response, 'Failed to delete product');
  },
};
