import axios from 'axios';

// 127.0.0.1 rather than localhost: `runserver` binds IPv4 only, while browsers
// resolve localhost to ::1 first and fail the request outright.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
});
