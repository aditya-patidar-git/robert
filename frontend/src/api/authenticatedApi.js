import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

// Create authenticated API client
const authenticatedApiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
authenticatedApiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('authToken');
    console.log('🔐 Frontend - Token from localStorage:', token ? 'Present' : 'Missing');
    console.log('🔐 Frontend - Request URL:', config.url);
    console.log('🔐 Frontend - Base URL:', config.baseURL);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔐 Frontend - Authorization header set');
    } else {
      console.log('❌ Frontend - No token found in localStorage');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
authenticatedApiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Let the AuthContext handle 401 errors instead of automatic redirect
    // This prevents conflicts during authentication checks
    return Promise.reject(error);
  }
);

export default authenticatedApiClient;
