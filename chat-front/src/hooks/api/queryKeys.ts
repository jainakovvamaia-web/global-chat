// Ключи кэша React Query в одном месте — по ним же делается инвалидация после изменений

import type { Id, InstitutionType } from "@/types";

export type MessageTarget = { kind: "chat"; id: Id } | { kind: "channel"; id: Id };

export const queryKeys = {
  me: ["me"] as const,
  settings: ["settings"] as const,
  myStats: ["me", "stats"] as const,
  cities: ["education", "cities"] as const,
  districts: (cityId: Id) => ["education", "districts", cityId] as const,
  institutions: (districtId: Id, type: InstitutionType) => ["education", "institutions", districtId, type] as const,
  communities: ["communities"] as const,
  community: (id: Id) => ["communities", id] as const,
  members: (id: Id) => ["communities", id, "members"] as const,
  channels: (id: Id) => ["communities", id, "channels"] as const,
  localChats: (id: Id) => ["communities", id, "local-chats"] as const,
  events: (id: Id) => ["communities", id, "events"] as const,
  invitations: (id: Id) => ["communities", id, "invitations"] as const,
  joinRequests: (id: Id) => ["communities", id, "join-requests"] as const,
  auditLog: (id: Id) => ["communities", id, "audit-log"] as const,
  stats: (id: Id) => ["communities", id, "stats"] as const,
  chats: ["chats"] as const,
  chatInvitations: (chatId: Id) => ["chats", chatId, "invitations"] as const,
  localChat: (id: Id) => ["local-chat", id] as const,
  event: (id: Id) => ["event", id] as const,
  messages: (target: MessageTarget) => ["messages", target.kind, target.id] as const,
  notifications: ["notifications"] as const,
  search: (q: string) => ["search", q] as const,
};
