import axios from "axios";

// In dev, VITE_API_URL is unset and "/api" is handled by the Vite proxy (vite.config.ts).
// In production the frontend and backend are on different origins, so VITE_API_URL
// must point at the deployed backend (e.g. https://bookleaf-api.onrender.com).
const apiBaseUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

export const api = axios.create({ baseURL: apiBaseUrl });

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export interface ApiErrorShape {
  error: { code: string; message: string; details?: Array<{ path: string; message: string }> };
}

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorShape | undefined;
    if (data?.error?.message) {
      const detail = data.error.details?.[0]?.message;
      return detail ? `${data.error.message}: ${detail}` : data.error.message;
    }
    if (err.message) return err.message;
  }
  return "Something went wrong. Please try again.";
}
