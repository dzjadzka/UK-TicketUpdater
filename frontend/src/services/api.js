import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
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

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (inviteToken, email, password, locale) => 
    api.post('/auth/register', { inviteToken, email, password, locale }),
};

// Credentials API
export const credentialsAPI = {
  getAll: () => api.get('/credentials'),
  create: (loginName, loginPassword, label) => 
    api.post('/credentials', { loginName, loginPassword, label }),
  update: (id, data) => api.put(`/credentials/${id}`, data),
  delete: (id) => api.delete(`/credentials/${id}`)
};

// Device Profiles API
export const deviceProfilesAPI = {
  getAll: () => api.get('/device-profiles'),
  create: (profile) => api.post('/device-profiles', profile),
  update: (id, profile) => api.put(`/device-profiles/${id}`, profile),
  delete: (id) => api.delete(`/device-profiles/${id}`)
};

// Downloads API
export const downloadsAPI = {
  trigger: (userIds, deviceProfile, outputDir) => 
    api.post('/downloads', { userIds, deviceProfile, outputDir }),
  getHistory: (limit = 50) => api.get('/history', { params: { limit } }),
  getTickets: (userId) => api.get(`/tickets/${userId}`)
};

// Admin API
export const adminAPI = {
  createInvite: (expiresInHours) =>
    api.post('/admin/invites', { expiresInHours }),
  getInvites: () => api.get('/admin/invites'),
  deleteInvite: (token) => api.delete(`/admin/invites/${token}`),
  getUsers: (params = {}) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getOverview: () => api.get('/admin/overview'),
  triggerBaseTicketCheck: () => api.post('/admin/jobs/check-base-ticket'),
  triggerDownloadAll: () => api.post('/admin/jobs/download-all'),
  getUserTickets: (id) => api.get(`/tickets/${id}`),
  getRecentErrors: (params = {}) => api.get('/admin/observability/errors', { params })
};

export default api;
