import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post('/api/auth/refresh', {
            refreshToken
          });

          const { accessToken } = response.data;
          localStorage.setItem('token', accessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: (data) => api.post('/auth/logout', data),
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  register: (userData) => api.post('/auth/register', userData),
  changePassword: (passwordData) => api.post('/auth/change-password', passwordData),
  setupTwoFactor: () => api.post('/auth/setup-2fa'),
  verifyTwoFactor: (data) => api.post('/auth/verify-2fa', data),
  disableTwoFactor: (data) => api.post('/auth/disable-2fa', data),
  getProfile: () => api.get('/users/me')
};

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getActivity: (id, params) => api.get(`/users/${id}/activity`, { params }),
  resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data)
};

// Menu API
export const menuAPI = {
  getCategories: () => api.get('/menu/categories'),
  getItems: (params) => api.get('/menu/items', { params }),
  getCategoryItems: (categoryId) => api.get(`/menu/categories/${categoryId}/items`),
  createCategory: (data) => api.post('/menu/categories', data),
  createItem: (data) => api.post('/menu/items', data),
  updateItem: (id, data) => api.put(`/menu/items/${id}`, data),
  deleteItem: (id) => api.delete(`/menu/items/${id}`),
  getModifierGroups: () => api.get('/menu/modifier-groups')
};

// Orders API
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, data) => api.patch(`/orders/${id}/status`, data),
  cancel: (id, data) => api.delete(`/orders/${id}`, { data })
};

// Customers API
export const customersAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  addLoyaltyPoints: (id, data) => api.post(`/customers/${id}/loyalty`, data)
};

// Inventory API
export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (id) => api.get(`/inventory/${id}`),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  adjustStock: (id, data) => api.patch(`/inventory/${id}/adjust`, data),
  getAlerts: () => api.get('/inventory/alerts'),
  getSuppliers: () => api.get('/inventory/suppliers')
};

// Payments API
export const paymentsAPI = {
  createIntent: (data) => api.post('/payments/create-intent', data),
  confirmPayment: (data) => api.post('/payments/confirm', data),
  processCash: (data) => api.post('/payments/cash', data),
  processRefund: (id, data) => api.post(`/payments/${id}/refund`, data),
  getOrderPayments: (orderId) => api.get(`/payments/order/${orderId}`)
};

// Reports API
export const reportsAPI = {
  getSales: (params) => api.get('/reports/sales', { params }),
  getInventory: () => api.get('/reports/inventory'),
  getCustomers: (params) => api.get('/reports/customers', { params }),
  getFinancial: (params) => api.get('/reports/financial', { params })
};

export default api;