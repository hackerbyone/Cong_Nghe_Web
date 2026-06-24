import { buildUrl, getHeaders, handleResponse } from '../utils/apiClient';

export const userService = {
  getAll: async (params = {}) => {
    const queryParams = {
      page: params.page || 1,
      pageSize: params.pageSize || 10,
      keyword: params.keyword || '',
    };

    const response = await fetch(buildUrl('/api/users', queryParams), {
      method: 'GET',
      headers: getHeaders(true),
    });
    return handleResponse(response, 'Failed to fetch users');
  },

  getById: async (id) => {
    const response = await fetch(buildUrl(`/api/users/${id}`), {
      method: 'GET',
      headers: getHeaders(true),
    });
    return handleResponse(response, 'Failed to fetch user');
  },

  create: async (userData) => {
    const response = await fetch(buildUrl('/api/users'), {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify(userData),
    });
    return handleResponse(response, 'Failed to create user');
  },

  update: async (id, userData) => {
    const response = await fetch(buildUrl(`/api/users/${id}`), {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(userData),
    });
    return handleResponse(response, 'Failed to update user');
  },

  delete: async (id) => {
    const response = await fetch(buildUrl(`/api/users/${id}`), {
      method: 'DELETE',
      headers: getHeaders(true),
    });
    return handleResponse(response, 'Failed to delete user');
  },

  changePassword: async (userId, oldPassword, newPassword) => {
    const response = await fetch(buildUrl(`/api/users/${userId}/change-password`), {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    return handleResponse(response, 'Failed to change password');
  },

  getMe: async () => {
    const response = await fetch(buildUrl('/api/users/me'), {
      method: 'GET',
      headers: getHeaders(true),
    });
    return handleResponse(response, 'Failed to fetch profile');
  },

  updateMe: async (data) => {
    const response = await fetch(buildUrl('/api/users/me'), {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify(data),
    });
    return handleResponse(response, 'Failed to update profile');
  },
};
