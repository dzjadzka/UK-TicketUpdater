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
  register: (inviteToken, email, password, locale, autoDownloadEnabled) =>
    api.post('/auth/register', { inviteToken, email, password, locale, autoDownloadEnabled }),
};

export const userAPI = {
  getProfile: () => api.get('/me'),
  getCredentials: () => api.get('/me/credentials'),
  updateCredentials: (payload) => api.put('/me/credentials', payload),
  getTickets: () => api.get('/me/tickets'),
  deleteAccount: () => api.delete('/me')
};

export default api;
