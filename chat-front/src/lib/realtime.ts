// Единственное WebSocket-соединение приложения (realtime-доставка событий от Express).
//
// • Соединение одно на вкладку: его используют все чаты, при переходе между чатами оно не
//   пересоздаётся — меняются только подписки.
// • Авторизация — существующим access token Supabase (первым сообщением, не в адресе).
// • Подписки считаются по ссылкам: два компонента подписаны на один чат — на сервер уходит
//   одна подписка; отписка — когда отписался последний.
// • Обрыв связи — переподключение с нарастающей паузой, повторная авторизация и переподписка.
//
// Сами сообщения отправляются и сохраняются через REST API; отсюда приходят только события.

import { API_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/supabase";
import type { Id, Message } from "@/types";

export type RealtimeTarget = { kind: "chat" | "channel"; id: Id };

export type RealtimeEvent =
  | { type: "authenticated" }
  | { type: "subscribed_chat"; target: RealtimeTarget }
  | { type: "unsubscribed_chat"; target: RealtimeTarget; reason?: "requested" | "access_lost" | "deleted" }
  | { type: "new_message"; target: RealtimeTarget; message: Message }
  | { type: "message_updated"; target: RealtimeTarget; message: Message }
  | { type: "message_deleted"; target: RealtimeTarget; messageId: Id }
  | { type: "typing_start"; target: RealtimeTarget; count: number }
  | { type: "typing_stop"; target: RealtimeTarget }
  | { type: "notification_created" }
  | { type: "error"; code: string; message: string; target?: RealtimeTarget }
  // Локальное событие: связь восстановлена после обрыва — пропущенное нужно догрузить через REST
  | { type: "resync" };

export type RealtimeStatus = "idle" | "connecting" | "authenticated" | "reconnecting";

type Listener = (event: RealtimeEvent) => void;
type StatusListener = (status: RealtimeStatus) => void;

export const topicOf = (target: RealtimeTarget) => `${target.kind}:${target.id}`;

const MAX_RETRY_DELAY_MS = 30_000;
const MAX_AUTH_FAILURES = 3; // токен трижды отклонён — ждём новой сессии, а не долбим сервер

interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export class RealtimeClient {
  private socket: WebSocketLike | null = null;
  private wanted = false; // соединение должно быть (пользователь вошёл)
  private status: RealtimeStatus = "idle";
  private everAuthenticated = false;
  private retry = 0;
  private authFailures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly topics = new Map<string, { target: RealtimeTarget; refs: number }>();
  private readonly listeners = new Set<Listener>();
  private readonly statusListeners = new Set<StatusListener>();

  constructor(
    private readonly getUrl: () => string,
    private readonly getToken: () => Promise<string | null>,
    private readonly createSocket: (url: string) => WebSocketLike,
  ) {}

  // ── Жизненный цикл ───────────────────────────────────────────────────────

  start(): void {
    this.wanted = true;
    this.authFailures = 0;
    if (!this.socket) this.open();
  }

  stop(): void {
    this.wanted = false;
    this.everAuthenticated = false;
    this.clearRetry();
    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, "logout");
    this.setStatus("idle");
  }

  // Supabase обновил токен — повторная авторизация на том же соединении
  async reauthenticate(): Promise<void> {
    if (!this.wanted) return;
    if (!this.socket) {
      this.open();
      return;
    }
    if (this.socket.readyState === 1) {
      const token = await this.getToken();
      if (token) this.sendRaw({ type: "auth", token });
    }
  }

  // Сеть вернулась — не ждём таймера переподключения
  reconnectNow(): void {
    if (!this.wanted || this.socket) return;
    this.clearRetry();
    this.open();
  }

  getStatus(): RealtimeStatus {
    return this.status;
  }

  // ── Подписки ─────────────────────────────────────────────────────────────

  // Возвращает функцию отписки (повторный вызов ничего не делает)
  subscribe(target: RealtimeTarget): () => void {
    const key = topicOf(target);
    const entry = this.topics.get(key);
    if (entry) entry.refs += 1;
    else {
      this.topics.set(key, { target, refs: 1 });
      if (this.status === "authenticated") this.sendRaw({ type: "subscribe_chat", target });
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const current = this.topics.get(key);
      if (!current) return;
      current.refs -= 1;
      if (current.refs > 0) return;
      this.topics.delete(key);
      if (this.status === "authenticated") this.sendRaw({ type: "unsubscribe_chat", target });
    };
  }

  typing(target: RealtimeTarget, active: boolean): void {
    if (this.status !== "authenticated" || !this.topics.has(topicOf(target))) return;
    this.sendRaw({ type: active ? "typing_start" : "typing_stop", target });
  }

  // ── Слушатели ────────────────────────────────────────────────────────────

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // ── Внутреннее ───────────────────────────────────────────────────────────

  private open(): void {
    this.clearRetry();
    this.setStatus(this.everAuthenticated ? "reconnecting" : "connecting");
    let socket: WebSocketLike;
    try {
      socket = this.createSocket(this.getUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      void this.getToken().then((token) => {
        if (this.socket !== socket) return;
        if (!token) {
          socket.close(1000, "no session");
          return;
        }
        this.sendRaw({ type: "auth", token });
      });
    };

    socket.onmessage = (message) => {
      if (this.socket !== socket || typeof message.data !== "string") return;
      let event: RealtimeEvent;
      try {
        event = JSON.parse(message.data) as RealtimeEvent;
      } catch {
        return;
      }
      if (event.type === "authenticated") this.handleAuthenticated();
      if (event.type === "error" && event.code === "UNAUTHORIZED") this.authFailures += 1;
      this.emit(event);
    };

    socket.onclose = () => {
      if (this.socket !== socket) return; // закрыли сами (stop) или уже есть новое соединение
      this.socket = null;
      if (this.wanted) this.scheduleReconnect();
      else this.setStatus("idle");
    };

    socket.onerror = () => {
      // Подробности недоступны браузеру; закрытие придёт в onclose — там и переподключение
    };
  }

  private handleAuthenticated(): void {
    const wasReconnect = this.everAuthenticated && this.status !== "authenticated";
    const firstAuthOnSocket = this.status !== "authenticated";
    this.everAuthenticated = true;
    this.retry = 0;
    this.authFailures = 0;
    this.setStatus("authenticated");
    // Новое соединение — сервер о подписках не знает: подписываемся заново на всё открытое
    if (firstAuthOnSocket) {
      for (const { target } of this.topics.values()) this.sendRaw({ type: "subscribe_chat", target });
    }
    if (wasReconnect) this.emit({ type: "resync" });
  }

  private scheduleReconnect(): void {
    if (!this.wanted || this.retryTimer) return;
    if (this.authFailures >= MAX_AUTH_FAILURES) {
      this.setStatus("idle"); // ждём новой сессии (reauthenticate/start)
      return;
    }
    this.setStatus("reconnecting");
    const base = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** this.retry);
    const delay = base / 2 + Math.random() * (base / 2); // разброс, чтобы вкладки не ломились разом
    this.retry += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.wanted && !this.socket) this.open();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private sendRaw(event: object): void {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(event));
  }

  private emit(event: RealtimeEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error("Realtime: ошибка обработчика события", error);
      }
    }
  }

  private setStatus(status: RealtimeStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of [...this.statusListeners]) listener(status);
  }
}

// Адрес WebSocket: NEXT_PUBLIC_WS_URL (в production — wss://…/ws) или тот же сервер, что и
// REST API (http→ws, https→wss, путь /ws). Страница открыта по https — только wss.
export function realtimeUrl(): string {
  const secure = window.location.protocol === "https:";
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return secure ? explicit.replace(/^ws:\/\//, "wss://") : explicit;
  const api = new URL(API_URL || "/api", window.location.href);
  api.protocol = api.protocol === "https:" || secure ? "wss:" : "ws:";
  api.pathname = "/ws";
  api.search = "";
  api.hash = "";
  return api.toString();
}

let client: RealtimeClient | null = null;

// Одно соединение на вкладку; создаётся только в браузере. Токен — текущая сессия Supabase
// (supabase-js сам её обновляет), отдельной системы токенов нет.
export function getRealtime(): RealtimeClient {
  client ??= new RealtimeClient(realtimeUrl, getAccessToken, (url) => new WebSocket(url) as unknown as WebSocketLike);
  return client;
}
