// ЕДИНСТВЕННЫЙ Axios instance приложения. Все запросы к Express идут через него:
// он сам подставляет токен сессии и приводит ошибки к понятному тексту.

import axios, { AxiosError } from "axios";
import { getAccessToken, getSupabase } from "./supabase";

// Адрес Express API. В production задаётся только через NEXT_PUBLIC_API_URL (https://…/api);
// запасной localhost — лишь для локальной разработки.
const DEV_API_URL = "http://localhost:5000/api";
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production" ? "" : DEV_API_URL);
if (!API_URL && typeof window !== "undefined") {
  console.error("NEXT_PUBLIC_API_URL не задан — укажите адрес backend в настройках Vercel (Environment Variables)");
}

export const api = axios.create({
  baseURL: API_URL || "/api",
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Сессия недействительна (например, вышли на другом устройстве) — выходим и здесь
api.interceptors.response.use(undefined, async (error: unknown) => {
  if (error instanceof AxiosError && error.response?.status === 401 && error.config?.headers.Authorization) {
    await getSupabase().auth.signOut({ scope: "local" });
  }
  return Promise.reject(error);
});

// Сервер отвечает { data: ... } — достаём data
export async function getData<T>(url: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const response = await api.get<{ data: T }>(url, { params });
  return response.data.data;
}

export async function sendData<T>(method: "post" | "patch" | "delete", url: string, body?: unknown): Promise<T> {
  const response = await api.request<{ data: T }>({ method, url, data: body });
  return response.status === 204 ? (undefined as T) : response.data.data;
}

export interface ApiErrorInfo {
  status: number | null;
  code: string | null;
  message: string;
}

// Текст ошибки для интерфейса: сообщение сервера или понятное описание сбоя сети
export function getApiError(error: unknown): ApiErrorInfo {
  if (error instanceof AxiosError) {
    const body: unknown = error.response?.data;
    const serverMessage =
      typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
        ? body.message
        : null;
    const serverCode =
      typeof body === "object" && body !== null && "code" in body && typeof body.code === "string" ? body.code : null;
    if (!error.response) {
      return { status: null, code: "NETWORK", message: "Нет связи с сервером. Проверьте, что backend запущен." };
    }
    return {
      status: error.response.status,
      code: serverCode,
      message: serverMessage ?? "Что-то пошло не так. Попробуйте ещё раз.",
    };
  }
  return { status: null, code: null, message: error instanceof Error ? error.message : "Неизвестная ошибка" };
}

export const getErrorMessage = (error: unknown) => getApiError(error).message;
