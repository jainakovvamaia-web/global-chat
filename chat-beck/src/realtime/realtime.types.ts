// События WebSocket (realtime). Сообщения сохраняются только через REST API → PostgreSQL;
// WebSocket лишь доставляет события о том, что уже записано в базу.
//
// Анонимность: ни в одном событии нет user_id, имени, email или аватара.
// Про «своё» сервер сообщает только флагом isMine — отдельно для каждого получателя.

import { z } from "zod";
import type { MessageDto } from "../types/dto";

// Место сообщений: чат (любой тип — общий, город, район, школа, вуз, «Рядом», закрытая группа) или канал
export const targetSchema = z.object({
  kind: z.enum(["chat", "channel"]),
  id: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/i, "Неверный идентификатор"),
});
export type RealtimeTarget = z.infer<typeof targetSchema>;

// ── Клиент → сервер ──────────────────────────────────────────────────────────

export const clientEventSchema = z.discriminatedUnion("type", [
  // Существующий access token Supabase (тот же, что в заголовке Authorization для REST)
  z.object({ type: z.literal("auth"), token: z.string().min(20).max(4096) }),
  z.object({ type: z.literal("subscribe_chat"), target: targetSchema }),
  z.object({ type: z.literal("unsubscribe_chat"), target: targetSchema }),
  z.object({ type: z.literal("typing_start"), target: targetSchema }),
  z.object({ type: z.literal("typing_stop"), target: targetSchema }),
]);
export type ClientEvent = z.infer<typeof clientEventSchema>;

// ── Сервер → клиент ──────────────────────────────────────────────────────────

export type ServerEvent =
  | { type: "authenticated" }
  | { type: "subscribed_chat"; target: RealtimeTarget }
  | { type: "unsubscribed_chat"; target: RealtimeTarget; reason?: "requested" | "access_lost" | "deleted" }
  | { type: "new_message"; target: RealtimeTarget; message: MessageDto }
  | { type: "message_updated"; target: RealtimeTarget; message: MessageDto }
  | { type: "message_deleted"; target: RealtimeTarget; messageId: string }
  // count — сколько ДРУГИХ людей печатает (без их личности)
  | { type: "typing_start"; target: RealtimeTarget; count: number }
  | { type: "typing_stop"; target: RealtimeTarget }
  | { type: "notification_created" }
  | { type: "error"; code: string; message: string; target?: RealtimeTarget };

// Ключ темы: «chat:<id>» или «channel:<id>»
export const topicOf = (target: RealtimeTarget): string => `${target.kind}:${target.id}`;
