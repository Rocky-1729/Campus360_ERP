import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45000,
});

// Attach auth token if available
api.interceptors.request.use(
  (config) => {
    try {
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Ignore if store not yet initialized
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response unwrapper & error handler
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      try {
        useAuthStore.getState().logout();
      } catch {
        // Ignore
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';

    const customError: any = new Error(message);
    customError.statusCode = error.response?.status;
    customError.data = error.response?.data;
    return Promise.reject(customError);
  }
);

export { api };
export default api;
