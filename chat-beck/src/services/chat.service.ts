// Чаты и группы. Кому виден чат, решает база (функции can_access_chat / available_chats) по данным строки
// в таблице chats. Поэтому новый чат, добавленный в базу, сразу доступен нужным людям без правок кода.
//
// Группа — это строка chats:
//   • открытая (is_private = false) — видна по месту из профиля (город, район, учебное заведение)
//     или участникам сообщества (локальные чаты «Рядом»);
//   • закрытая (is_private = true) — только участникам (chat_members) по приглашению, создателю и admin.
// Создаёт группы только администратор платформы.

import { supabaseAdmin } from "../config/supabase";
import type { ChatAccessType, ChatRow } from "../types/database.types";
import type { ChatDto, LocalChatDto } from "../types/dto";
import { apiErrors } from "../utils/apiErrors";
import { check, maybe, must } from "../utils/db";
import type { CreateChatInput, UpdateChatInput } from "../validators/chat.validators";
import type { LocalChatInput } from "../validators/community.validators";
import {
  getCommunityRow,
  MANAGER_ROLES,
  MODERATOR_ROLES,
  requireChatAccess,
  requireCommunityRole,
  requireMember,
} from "./access.service";
import { addAudit } from "./audit.service";
import { closeTopic, revalidateAccess, revalidateAllAccess } from "../realtime/realtime.service";
import { isPlatformAdmin } from "./user.service";

// Кто смотрит: от этого зависит флаг canManage (кнопки «Пригласить», «Удалить группу»)
export interface ChatViewer {
  userId: string;
  isAdmin: boolean;
}

export async function getViewer(userId: string): Promise<ChatViewer> {
  return { userId, isAdmin: await isPlatformAdmin(userId) };
}

const accessOf = (row: ChatRow): ChatAccessType => (row.is_private ? "private" : "public");

// Управлять группой (приглашения, изменение, удаление) может её создатель или admin платформы
export const canManageChat = (row: ChatRow, viewer: ChatViewer) => viewer.isAdmin || row.created_by === viewer.userId;

export const toChatDto = (row: ChatRow, viewer: ChatViewer): ChatDto => ({
  id: row.id,
  name: row.name,
  type: row.type,
  cityId: row.city_id,
  districtId: row.district_id,
  institutionId: row.institution_id,
  communityId: row.community_id,
  description: row.description,
  emoji: row.emoji,
  access: accessOf(row),
  canManage: canManageChat(row, viewer),
});

// Группа, которой пользователь может управлять. Чужую закрытую группу не раскрываем (404).
export async function requireManageableChat(userId: string, chatId: string): Promise<{ chat: ChatRow; viewer: ChatViewer }> {
  const chat = await requireChatAccess(userId, chatId);
  const viewer = await getViewer(userId);
  if (!canManageChat(chat, viewer)) {
    throw apiErrors.forbidden("Управлять группой может только её создатель или администратор", "NOT_CHAT_MANAGER");
  }
  return { chat, viewer };
}

// Адрес группы для конкретного пользователя: чат по месту открывается внутри любого его сообщества,
// локальный чат — в разделе «Рядом» своего сообщества
export async function chatHref(userId: string, chat: Pick<ChatRow, "id" | "type" | "community_id">): Promise<string> {
  if (chat.type === "local" && chat.community_id) return `/${chat.community_id}/nearby/${chat.id}`;
  const membership = maybe(
    await supabaseAdmin
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId)
      .order("joined_at")
      .limit(1)
      .maybeSingle(),
  );
  return membership ? `/${membership.community_id}/chat/place/${encodeURIComponent(chat.id)}` : "/communities";
}

// ── Чаты по месту и закрытые группы: общий, город, район, школа/университет ──

export async function listAvailableChats(userId: string): Promise<ChatDto[]> {
  const [rows, viewer] = await Promise.all([
    supabaseAdmin.rpc("available_chats", { p_user: userId }),
    getViewer(userId),
  ]);
  return must(rows).map((row) => toChatDto(row, viewer));
}

export async function getChat(userId: string, chatId: string): Promise<ChatDto> {
  const [row, viewer] = await Promise.all([requireChatAccess(userId, chatId), getViewer(userId)]);
  return toChatDto(row, viewer);
}

// Создать группу может только администратор платформы: роль берётся из базы, а не из запроса.
// Закрытая группа: создатель сразу становится её участником, остальные входят по коду приглашения.
export async function createChat(userId: string, input: CreateChatInput): Promise<ChatDto> {
  const viewer = await getViewer(userId);
  if (!viewer.isAdmin) {
    throw apiErrors.forbidden("Создавать группы могут только администраторы", "ADMIN_ONLY");
  }
  if (input.type === "local" && input.communityId) await getCommunityRow(input.communityId);

  const row = must(
    await supabaseAdmin
      .from("chats")
      .insert({
        ...(input.id ? { id: input.id } : {}),
        name: input.name,
        type: input.type,
        city_id: input.cityId,
        district_id: input.districtId,
        institution_id: input.institutionId,
        community_id: input.communityId,
        description: input.description,
        emoji: input.emoji,
        is_private: input.access === "private",
        created_by: userId,
      })
      .select("*")
      .single(),
  );
  check(await supabaseAdmin.from("chat_members").insert({ chat_id: row.id, user_id: userId }));
  if (row.community_id) await addAudit(row.community_id, `Создана группа «${row.name}»`);
  return toChatDto(row, viewer);
}

export async function updateChat(userId: string, chatId: string, input: UpdateChatInput): Promise<ChatDto> {
  const { viewer } = await requireManageableChat(userId, chatId);
  const patch: Partial<ChatRow> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.emoji !== undefined) patch.emoji = input.emoji;
  if (input.access !== undefined) patch.is_private = input.access === "private";
  const row = must(await supabaseAdmin.from("chats").update(patch).eq("id", chatId).select("*").single());
  if (input.access !== undefined) revalidateAllAccess(); // группа стала закрытой — посторонние отписываются
  return toChatDto(row, viewer);
}

// Удалить группу: создатель или admin. Сообщения, участники и коды удалятся каскадом.
export async function deleteChat(userId: string, chatId: string): Promise<void> {
  const { chat } = await requireManageableChat(userId, chatId);
  check(await supabaseAdmin.from("chats").delete().eq("id", chatId));
  closeTopic({ kind: "chat", id: chatId });
  if (chat.community_id) await addAudit(chat.community_id, `Удалена группа «${chat.name}»`);
}

// ── Локальные чаты «Рядом» (type = 'local', принадлежат сообществу) ─────────

async function toLocalChatDtos(userId: string, rows: ChatRow[]): Promise<LocalChatDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [counts, mine, lastMessages, viewer] = await Promise.all([
    supabaseAdmin.rpc("chat_member_counts", { p_chats: ids }),
    supabaseAdmin.from("chat_members").select("chat_id").eq("user_id", userId).in("chat_id", ids),
    supabaseAdmin.rpc("chat_last_messages", { p_chats: ids }),
    getViewer(userId),
  ]);
  const countById = new Map(must(counts).map((row) => [row.chat_id, row]));
  const joined = new Set(must(mine).map((row) => row.chat_id));
  const lastById = new Map(must(lastMessages).map((row) => [row.chat_id, row]));
  return rows
    // Закрытую группу видят только её участники, создатель и admin
    .filter((row) => !row.is_private || joined.has(row.id) || canManageChat(row, viewer))
    .map((row) => {
      const last = lastById.get(row.id);
      return {
        ...toChatDto(row, viewer),
        membersCount: countById.get(row.id)?.members_count ?? 0,
        onlineCount: countById.get(row.id)?.online_count ?? 0,
        joined: joined.has(row.id),
        lastMessage: last ? { content: last.content.slice(0, 200), createdAt: last.created_at } : null,
      };
    });
}

export async function listLocalChats(userId: string, communityId: string): Promise<LocalChatDto[]> {
  await requireMember(userId, communityId);
  const rows = must(
    await supabaseAdmin
      .from("chats")
      .select("*")
      .eq("type", "local")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false }),
  );
  return toLocalChatDtos(userId, rows);
}

export async function getLocalChat(userId: string, chatId: string): Promise<LocalChatDto> {
  const row = await requireChatAccess(userId, chatId);
  if (row.type !== "local") throw apiErrors.notFound("Чат не найден");
  const [dto] = await toLocalChatDtos(userId, [row]);
  if (!dto) throw apiErrors.notFound("Чат не найден");
  return dto;
}

// Локальный чат «Рядом» — тоже группа: создают admin платформы или владелец/администратор сообщества
export async function createLocalChat(userId: string, communityId: string, input: LocalChatInput): Promise<LocalChatDto> {
  if (!(await isPlatformAdmin(userId))) await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  else await getCommunityRow(communityId);
  const row = must(
    await supabaseAdmin
      .from("chats")
      .insert({
        name: input.name,
        type: "local",
        community_id: communityId,
        description: input.description,
        emoji: input.emoji,
        is_private: input.access === "private",
        created_by: userId,
      })
      .select("*")
      .single(),
  );
  check(await supabaseAdmin.from("chat_members").insert({ chat_id: row.id, user_id: userId }));
  await addAudit(communityId, `Создан локальный чат «${row.name}»`);
  return getLocalChat(userId, row.id);
}

export async function deleteLocalChat(userId: string, chatId: string): Promise<void> {
  const row = await requireChatAccess(userId, chatId);
  if (row.type !== "local" || !row.community_id) throw apiErrors.notFound("Чат не найден");
  // Удалить может создатель, admin платформы или модератор сообщества
  const viewer = await getViewer(userId);
  if (!canManageChat(row, viewer)) await requireCommunityRole(userId, row.community_id, MODERATOR_ROLES);
  check(await supabaseAdmin.from("chats").delete().eq("id", chatId));
  closeTopic({ kind: "chat", id: chatId });
  await addAudit(row.community_id, `Удалён локальный чат «${row.name}»`);
}

// «Вступить» в открытый локальный чат — отметка участия. В закрытый чат без приглашения не пустит
// requireChatAccess: для постороннего такого чата «нет» (404).
export async function joinLocalChat(userId: string, chatId: string): Promise<LocalChatDto> {
  const row = await requireChatAccess(userId, chatId);
  if (row.type !== "local") throw apiErrors.badRequest("Присоединиться можно только к локальному чату");
  const { error } = await supabaseAdmin.from("chat_members").insert({ chat_id: chatId, user_id: userId });
  if (error && error.code !== "23505") check({ error });
  return getLocalChat(userId, chatId);
}

// Выйти из группы. Локальный чат: снимается отметка «участник» (вернётся обновлённый чат).
// Закрытая группа: доступ пропадает — возвращается null, frontend уводит со страницы группы.
// Из открытого чата по месту выйти нельзя: он доступен по данным профиля.
export async function leaveChat(userId: string, chatId: string): Promise<LocalChatDto | null> {
  const row = await requireChatAccess(userId, chatId);
  if (row.type !== "local" && !row.is_private) {
    throw apiErrors.badRequest("Из чата по месту нельзя выйти — он доступен по данным профиля");
  }
  check(await supabaseAdmin.from("chat_members").delete().eq("chat_id", chatId).eq("user_id", userId));
  revalidateAccess(userId); // вышел из закрытой группы — её события больше не приходят
  if (row.is_private && !canManageChat(row, await getViewer(userId))) return null;
  return row.type === "local" ? getLocalChat(userId, chatId) : null;
}
