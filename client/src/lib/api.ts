import axios from "axios";

export const api = axios.create({ baseURL: "/api" });

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
