import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

let unauthorizedHandler: (() => void) | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const status =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { status?: unknown } }).response?.status === "number"
        ? (error as { response: { status: number } }).response.status
        : null;
    if (status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw error;
  },
);

export function setApiToken(token: string | null): void {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}
