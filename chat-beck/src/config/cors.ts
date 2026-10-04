// Единая настройка CORS для REST API и проверка Origin для WebSocket.
//
// Разрешённые адреса берутся из process.env.FRONTEND_URL (через env.ts), например:
//   FRONTEND_URL=https://global-chat-83ev.vercel.app,http://localhost:3000
// «*» не используется: при credentials: true браузер его всё равно не принимает,
// поэтому в ответ отражается только конкретный разрешённый Origin.

import type { CorsOptions } from "cors";
import { env } from "./env";

// Origin приводится к виду, в котором его присылает браузер: схема + хост (+ порт),
// без пути, «/» в конце и лишних кавычек/пробелов
export function normalizeOrigin(value: string): string | null {
  const cleaned = value.trim().replace(/^["']+|["']+$/g, "");
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

const allowedOrigins = new Set(
  env.FRONTEND_ORIGINS.map(normalizeOrigin).filter((origin): origin is string => origin !== null),
);

export const getAllowedOrigins = (): string[] => [...allowedOrigins];

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return normalized !== null && allowedOrigins.has(normalized);
}

// Отклонённый Origin пишем в лог один раз — сразу видно, с какого адреса пришёл запрос
const reportedOrigins = new Set<string>();
export function reportRejectedOrigin(origin: string, source: "http" | "ws"): void {
  const key = `${source}|${origin}`;
  if (reportedOrigins.has(key) || reportedOrigins.size > 100) return;
  reportedOrigins.add(key);
  console.warn(
    `CORS: адрес «${origin}» (${source}) не входит в FRONTEND_URL. Разрешены: ${getAllowedOrigins().join(", ")}`,
  );
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Без Origin — не браузерный запрос (health check хостинга, curl): CORS-заголовки не нужны
    if (!origin) return callback(null, false);
    if (isAllowedOrigin(origin)) return callback(null, origin); // отражаем именно этот Origin
    reportRejectedOrigin(origin, "http");
    // Не ошибка 500, а ответ без CORS-заголовков — браузер сам заблокирует чужой сайт
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  maxAge: 600, // браузер кэширует preflight на 10 минут
  optionsSuccessStatus: 204,
};
