import axios from 'axios';

let unauthorizedHandler = null;

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';

  const { protocol, hostname, port } = window.location;
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname);

  // For local development, default backend port stays 5000 unless Vite is proxying.
  if (isLocalHost && port === '5173') return `${protocol}//${hostname}:5000/api`;

  // For deployed environments, prefer same-origin API path.
  return `${protocol}//${hostname}${port ? `:${port}` : ''}/api`;
};

const fallbackMessages = {
  400: 'The request could not be processed.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource could not be found.',
  409: 'This record already exists.',
  429: 'Too many requests. Please try again in a moment.',
  500: 'The server could not complete your request.'
};

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.data = options.data;
    this.code = options.code;
  }
}

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const extractData = (response, fallback = {}) => {
  const payload = response?.data;
  const data = payload?.data;
  if (data == null || data === '') return fallback;
  return data;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || getDefaultApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ttm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const isNetworkError = !error.response;
    const message = data?.message
      || (isNetworkError ? 'Unable to reach the server. Please check your connection and try again.' : '')
      || fallbackMessages[status]
      || error.message
      || 'Something went wrong';

    if (status === 401 && typeof unauthorizedHandler === 'function') {
      unauthorizedHandler({
        status,
        message,
        code: data?.code
      });
    }

    const err = new ApiError(message, {
      status,
      data,
      code: data?.code
    });
    return Promise.reject(err);
  }
);
