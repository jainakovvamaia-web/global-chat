// WebSocket-сервер на том же HTTP-сервере и порту, что и Express (путь /ws).
//
// Протокол (JSON):
//   1. Клиент подключается и первым сообщением присылает { type: "auth", token } — существующий
//      access token Supabase. Токен проверяет Supabase Auth (как в authMiddleware для REST).
//      В адресе подключения токен не передаётся — он не попадёт в логи.
//   2. { type: "subscribe_chat", target } — сервер проверяет доступ к чату/каналу по базе.
//   3. Сервер присылает события: new_message, message_updated, message_deleted, typing_*,
//      notification_created. Сами сообщения отправляются и сохраняются только через REST API.

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { type Connection, type RealtimeHub } from "./realtime.hub";
import { clientEventSchema, type ClientEvent, type ServerEvent } from "./realtime.types";

export const WEBSOCKET_PATH = "/ws";

const AUTH_TIMEOUT_MS = 10_000; // не прислал токен — отключаем
const HEARTBEAT_MS = 30_000; // ping, чтобы находить «мёртвые» подключения
const REVALIDATE_MS = 120_000; // периодическая перепроверка доступа ко всем подпискам
const TOKEN_GRACE_MS = 30_000; // запас после истечения токена: клиент успеет прислать новый
const MAX_PAYLOAD_BYTES = 16 * 1024;
const MAX_CONNECTIONS_PER_USER = 10;
const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 60; // событий от клиента за окно

// Коды закрытия (4000–4999 — свои)
export const CLOSE_CODES = {
  unauthorized: 4401,
  tokenExpired: 4001,
  tooManyConnections: 4008,
  rateLimited: 4029,
} as const;

export interface RealtimeServerOptions {
  hub: RealtimeHub;
  // Проверка существующего access token Supabase → id пользователя или null
  verifyToken: (token: string) => Promise<{ userId: string } | null>;
  // Адреса сайта (FRONTEND_URL). Подключения со страниц других сайтов отклоняются.
  // null — без проверки (только для тестов).
  allowedOrigins: readonly string[] | null;
  // Для диагностики: сообщить, что подключение с чужого адреса отклонено
  onRejectedOrigin?: (origin: string) => void;
}

// Время истечения JWT (поле exp). Подпись уже проверил Supabase Auth — здесь только читаем срок.
function tokenExpiresAt(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const exp: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function rejectUpgrade(socket: Duplex, status: number, text: string): void {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachWebSocket(server: Server, options: RealtimeServerOptions): { close: () => void } {
  const { hub, verifyToken, allowedOrigins, onRejectedOrigin } = options;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
  const alive = new WeakMap<WebSocket, boolean>();

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (pathname !== WEBSOCKET_PATH) {
      rejectUpgrade(socket, 404, "Not Found");
      return;
    }
    // Браузер всегда присылает Origin: чужой сайт не сможет подключиться от имени пользователя
    const origin = request.headers.origin;
    if (allowedOrigins && origin && !allowedOrigins.includes(origin.toLowerCase())) {
      onRejectedOrigin?.(origin);
      rejectUpgrade(socket, 403, "Forbidden");
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  });

  wss.on("connection", (ws: WebSocket) => {
    const connection = hub.add(ws);
    alive.set(ws, true);
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    let windowStart = Date.now();
    let eventsInWindow = 0;

    const send = (event: ServerEvent) => hub.send(connection, event);
    const fail = (code: string, message: string, extra: Partial<Extract<ServerEvent, { type: "error" }>> = {}) =>
      send({ type: "error", code, message, ...extra });

    // События одного подключения обрабатываются строго по очереди: «подписаться» и сразу
    // «отписаться» не перепутаются из-за того, что проверка доступа идёт асинхронно
    let queue: Promise<void> = Promise.resolve();

    const authTimer = setTimeout(() => {
      if (!connection.userId) ws.close(CLOSE_CODES.unauthorized, "auth timeout");
    }, AUTH_TIMEOUT_MS);

    const scheduleExpiry = (token: string) => {
      if (expiryTimer) clearTimeout(expiryTimer);
      const expiresAt = tokenExpiresAt(token);
      if (!expiresAt) return;
      expiryTimer = setTimeout(() => {
        fail("TOKEN_EXPIRED", "Сессия истекла — переподключитесь с новым токеном");
        ws.close(CLOSE_CODES.tokenExpired, "token expired");
      }, Math.max(0, expiresAt - Date.now()) + TOKEN_GRACE_MS);
    };

    const handle = async (event: ClientEvent, current: Connection) => {
      if (event.type === "auth") {
        const verified = await verifyToken(event.token);
        if (!verified) {
          fail("UNAUTHORIZED", "Сессия недействительна — войдите снова");
          ws.close(CLOSE_CODES.unauthorized, "unauthorized");
          return;
        }
        if (current.userId !== verified.userId && hub.connectionCount(verified.userId) >= MAX_CONNECTIONS_PER_USER) {
          fail("TOO_MANY_CONNECTIONS", "Слишком много открытых вкладок");
          ws.close(CLOSE_CODES.tooManyConnections, "too many connections");
          return;
        }
        hub.authenticate(current, verified.userId);
        scheduleExpiry(event.token);
        send({ type: "authenticated" });
        return;
      }

      if (!current.userId) {
        fail("NOT_AUTHENTICATED", "Сначала авторизуйтесь");
        return;
      }

      switch (event.type) {
        case "subscribe_chat":
          if (await hub.subscribe(current, event.target)) send({ type: "subscribed_chat", target: event.target });
          else fail("FORBIDDEN", "Нет доступа к этому чату", { target: event.target });
          return;
        case "unsubscribe_chat":
          hub.unsubscribe(current, event.target);
          send({ type: "unsubscribed_chat", target: event.target, reason: "requested" });
          return;
        case "typing_start":
          hub.startTyping(current, event.target);
          return;
        case "typing_stop":
          hub.stopTyping(current.userId, event.target);
          return;
      }
    };

    ws.on("message", (data: RawData, isBinary: boolean) => {
      // Ограничение частоты: спам событиями не должен нагружать сервер и базу
      const now = Date.now();
      if (now - windowStart > RATE_WINDOW_MS) {
        windowStart = now;
        eventsInWindow = 0;
      }
      eventsInWindow += 1;
      if (eventsInWindow > RATE_LIMIT * 3) {
        ws.close(CLOSE_CODES.rateLimited, "rate limited");
        return;
      }
      if (eventsInWindow > RATE_LIMIT) {
        fail("RATE_LIMITED", "Слишком много событий — подождите немного");
        return;
      }

      if (isBinary) {
        fail("BAD_EVENT", "Ожидается JSON");
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        fail("BAD_EVENT", "Неверный JSON");
        return;
      }
      const result = clientEventSchema.safeParse(parsed);
      if (!result.success) {
        fail("BAD_EVENT", result.error.issues[0]?.message ?? "Неверное событие");
        return;
      }
      const event = result.data;
      queue = queue
        .then(() => handle(event, connection))
        .catch((error: unknown) => {
          console.error("WebSocket: ошибка обработки события", error);
          fail("INTERNAL", "Внутренняя ошибка сервера");
        });
    });

    ws.on("pong", () => alive.set(ws, true));

    ws.on("close", () => {
      clearTimeout(authTimer);
      if (expiryTimer) clearTimeout(expiryTimer);
      hub.remove(connection);
    });

    ws.on("error", (error) => console.error("WebSocket: ошибка соединения", error.message));
  });

  // Heartbeat: не ответил на ping за 30 с — соединение мёртвое, закрываем и чистим
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_MS);

  // Доступ мог пропасть (удалили из сообщества, сменили район в профиле) — перепроверяем подписки
  const revalidation = setInterval(() => {
    hub.revalidate().catch((error: unknown) => console.error("WebSocket: ошибка перепроверки доступа", error));
  }, REVALIDATE_MS);

  const close = () => {
    clearInterval(heartbeat);
    clearInterval(revalidation);
    for (const ws of wss.clients) ws.close(1001, "server shutdown");
    wss.close();
  };
  server.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(revalidation);
  });

  return { close };
}
