// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
export const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 30000;
export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'YouTube to Audio Downloader';

// Helper to build API URLs
export const getApiUrl = (path: string) => `${API_BASE_URL}${path}`;
