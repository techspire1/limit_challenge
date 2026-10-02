import axios from 'axios';

/**
 * Override with `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local`. On a
 * Windows host where `localhost` resolves to IPv6 `::1` before IPv4, point it
 * at `http://127.0.0.1:8000/api`, since `runserver` listens on IPv4.
 */
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
});
