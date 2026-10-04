// Реестр WebSocket-подключений и рассылка событий.
//
//   userId  → подключения пользователя (вкладки, устройства — их может быть несколько)
//   topic   → подключения, подписанные на чат/канал («chat:<id>», «channel:<id>»)
//
// Кто может подписаться на тему, решает access-проверка (та же логика, что у REST API).
// Подписки периодически перепроверяются: потерял доступ — перестал получать события.
// При отключении всё, что относится к подключению, удаляется — коллекции не растут.

import { topicOf, type RealtimeTarget, type ServerEvent } from "./realtime.types";

// Минимум, что нужно хабу от WebSocket — так его легко проверять тестами
export interface RealtimeSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readonly readyState: number;
}

const OPEN = 1;
const TYPING_TTL_MS = 6_000; // клиент повторяет typing_start каждые ~3 с, пока человек печатает
export const MAX_SUBSCRIPTIONS_PER_CONNECTION = 100;

export interface Connection {
  socket: RealtimeSocket;
  userId: string | null; // null — ещё не авторизован
  topics: Map<string, RealtimeTarget>;
}

type AccessCheck = (userId: string, target: RealtimeTarget) => Promise<boolean>;

export class RealtimeHub {
  private readonly connections = new Set<Connection>();
  private readonly byUser = new Map<string, Set<Connection>>();
  private readonly byTopic = new Map<string, Set<Connection>>();
  // topic → (userId → таймер), кто сейчас печатает. В базу не пишется.
  private readonly typing = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

  constructor(private readonly canAccess: AccessCheck) {}

  // ── Подключения ──────────────────────────────────────────────────────────

  add(socket: RealtimeSocket): Connection {
    const connection: Connection = { socket, userId: null, topics: new Map() };
    this.connections.add(connection);
    return connection;
  }

  // Авторизация (и повторная — после обновления токена). Другой пользователь на том же
  // подключении — подписки прежнего снимаются, чтобы не получить чужие события.
  authenticate(connection: Connection, userId: string): void {
    if (connection.userId === userId) return;
    if (connection.userId) {
      this.unsubscribeAll(connection);
      this.removeFromIndex(this.byUser, connection.userId, connection);
    }
    connection.userId = userId;
    this.addToIndex(this.byUser, userId, connection);
  }

  remove(connection: Connection): void {
    this.unsubscribeAll(connection);
    if (connection.userId) this.removeFromIndex(this.byUser, connection.userId, connection);
    this.connections.delete(connection);
  }

  connectionCount(userId?: string): number {
    return userId ? (this.byUser.get(userId)?.size ?? 0) : this.connections.size;
  }

  // ── Подписки ─────────────────────────────────────────────────────────────

  // Проверка доступа ВСЕГДА на сервере: chatId от клиента — только просьба
  async subscribe(connection: Connection, target: RealtimeTarget): Promise<boolean> {
    const userId = connection.userId;
    if (!userId) return false;
    const topic = topicOf(target);
    if (connection.topics.has(topic)) return true; // повторная подписка — без дублей
    if (connection.topics.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION) return false;
    if (!(await this.canAccess(userId, target))) return false;
    // Пока шла проверка, подключение могло закрыться или смениться пользователь
    if (!this.connections.has(connection) || connection.userId !== userId) return false;
    connection.topics.set(topic, target);
    this.addToIndex(this.byTopic, topic, connection);
    return true;
  }

  unsubscribe(connection: Connection, target: RealtimeTarget): void {
    const topic = topicOf(target);
    if (!connection.topics.delete(topic)) return;
    this.removeFromIndex(this.byTopic, topic, connection);
    if (connection.userId && !this.userSubscribed(connection.userId, topic)) {
      this.stopTyping(connection.userId, target);
    }
  }

  private unsubscribeAll(connection: Connection): void {
    for (const target of [...connection.topics.values()]) this.unsubscribe(connection, target);
  }

  isSubscribed(connection: Connection, target: RealtimeTarget): boolean {
    return connection.topics.has(topicOf(target));
  }

  private userSubscribed(userId: string, topic: string): boolean {
    for (const connection of this.byUser.get(userId) ?? []) {
      if (connection.topics.has(topic)) return true;
    }
    return false;
  }

  // Перепроверить доступ: всем подпискам пользователя (после выхода из группы, смены места
  // в профиле и т.п.) или всем подпискам вообще (периодически). Нет доступа — отписываем.
  async revalidate(userId?: string): Promise<void> {
    const connections = userId ? [...(this.byUser.get(userId) ?? [])] : [...this.connections];
    const cache = new Map<string, Promise<boolean>>();
    for (const connection of connections) {
      const owner = connection.userId;
      if (!owner) continue;
      for (const target of [...connection.topics.values()]) {
        const key = `${owner}|${topicOf(target)}`;
        let allowed = cache.get(key);
        if (!allowed) {
          allowed = this.canAccess(owner, target).catch(() => true); // сбой базы — не рвём подписку
          cache.set(key, allowed);
        }
        if (!(await allowed) && connection.topics.has(topicOf(target))) {
          this.unsubscribe(connection, target);
          this.send(connection, { type: "unsubscribed_chat", target, reason: "access_lost" });
        }
      }
    }
  }

  // Чат или канал удалён — все подписчики получают уведомление и отписываются
  closeTopic(target: RealtimeTarget): void {
    const topic = topicOf(target);
    for (const connection of [...(this.byTopic.get(topic) ?? [])]) {
      this.unsubscribe(connection, target);
      this.send(connection, { type: "unsubscribed_chat", target, reason: "deleted" });
    }
    this.clearTyping(topic);
  }

  // ── Рассылка ─────────────────────────────────────────────────────────────

  send(connection: Connection, event: ServerEvent): void {
    if (connection.socket.readyState !== OPEN) return;
    try {
      connection.socket.send(JSON.stringify(event));
    } catch (error) {
      console.error("WebSocket: не удалось отправить событие", error);
    }
  }

  // Событие подписчикам темы. build вызывается один раз на пользователя: так у каждого
  // получателя свой isMine / reactedByMe, а чужой user_id никуда не уходит.
  publish(target: RealtimeTarget, build: (userId: string) => ServerEvent): number {
    const subscribers = this.byTopic.get(topicOf(target));
    if (!subscribers) return 0;
    const perUser = new Map<string, string>();
    let delivered = 0;
    for (const connection of subscribers) {
      const userId = connection.userId;
      if (!userId || connection.socket.readyState !== OPEN) continue;
      let payload = perUser.get(userId);
      if (payload === undefined) {
        payload = JSON.stringify(build(userId));
        perUser.set(userId, payload);
      }
      try {
        connection.socket.send(payload);
        delivered += 1;
      } catch (error) {
        console.error("WebSocket: не удалось отправить событие", error);
      }
    }
    return delivered;
  }

  sendToUser(userId: string, event: ServerEvent): void {
    for (const connection of this.byUser.get(userId) ?? []) this.send(connection, event);
  }

  // ── «Печатает…» ──────────────────────────────────────────────────────────

  startTyping(connection: Connection, target: RealtimeTarget): void {
    const userId = connection.userId;
    if (!userId || !this.isSubscribed(connection, target)) return;
    const topic = topicOf(target);
    let typers = this.typing.get(topic);
    if (!typers) {
      typers = new Map();
      this.typing.set(topic, typers);
    }
    const existing = typers.get(userId);
    if (existing) clearTimeout(existing);
    typers.set(userId, setTimeout(() => this.stopTyping(userId, target), TYPING_TTL_MS));
    if (!existing) this.broadcastTyping(target);
  }

  stopTyping(userId: string, target: RealtimeTarget): void {
    const topic = topicOf(target);
    const typers = this.typing.get(topic);
    const timer = typers?.get(userId);
    if (!typers || !timer) return;
    clearTimeout(timer);
    typers.delete(userId);
    if (typers.size === 0) this.typing.delete(topic);
    this.broadcastTyping(target);
  }

  // Каждому получателю — сколько печатает ДРУГИХ людей (себя он не видит)
  private broadcastTyping(target: RealtimeTarget): void {
    const typers = this.typing.get(topicOf(target));
    this.publish(target, (userId) => {
      const count = typers ? typers.size - (typers.has(userId) ? 1 : 0) : 0;
      return count > 0 ? { type: "typing_start", target, count } : { type: "typing_stop", target };
    });
  }

  private clearTyping(topic: string): void {
    for (const timer of this.typing.get(topic)?.values() ?? []) clearTimeout(timer);
    this.typing.delete(topic);
  }

  // ── Индексы ──────────────────────────────────────────────────────────────

  private addToIndex(index: Map<string, Set<Connection>>, key: string, connection: Connection): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(connection);
  }

  private removeFromIndex(index: Map<string, Set<Connection>>, key: string, connection: Connection): void {
    const set = index.get(key);
    if (!set) return;
    set.delete(connection);
    if (set.size === 0) index.delete(key); // пустые коллекции не оставляем
  }

  // Для проверок и диагностики: сколько тем и «печатающих» сейчас в памяти
  stats(): { connections: number; users: number; topics: number; typingTopics: number } {
    return {
      connections: this.connections.size,
      users: this.byUser.size,
      topics: this.byTopic.size,
      typingTopics: this.typing.size,
    };
  }
}
