// Проверки прав — единое место. Каждая функция либо возвращает нужные данные, либо бросает
// 403/404. Проверка всегда на сервере: скрытая кнопка в интерфейсе защитой не считается.

import { supabaseAdmin } from "../config/supabase";
import type { ChannelRow, ChatRow, CommunityRole, CommunityRow } from "../types/database.types";
import { apiErrors } from "../utils/apiErrors";
import { maybe, must } from "../utils/db";
import { isPlatformAdmin } from "./user.service";

export const MANAGER_ROLES: CommunityRole[] = ["owner", "admin"];
export const MODERATOR_ROLES: CommunityRole[] = ["owner", "admin", "moderator"];

export async function getCommunityRow(communityId: string): Promise<CommunityRow> {
  return must(
    await supabaseAdmin.from("communities").select("*").eq("id", communityId).maybeSingle(),
    "Сообщество не найдено",
  );
}

export async function getMyRole(userId: string, communityId: string): Promise<CommunityRole | null> {
  const row = maybe(
    await supabaseAdmin
      .from("community_members")
      .select("role")
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .maybeSingle(),
  );
  return row?.role ?? null;
}

// Участник сообщества. Закрытое сообщество постороннему «не существует» (404), открытое — 403.
export async function requireMember(
  userId: string,
  communityId: string,
): Promise<{ community: CommunityRow; role: CommunityRole }> {
  const community = await getCommunityRow(communityId);
  const role = await getMyRole(userId, communityId);
  if (!role) {
    if (community.is_private) throw apiErrors.notFound("Сообщество не найдено");
    throw apiErrors.forbidden("Сначала вступите в сообщество", "NOT_A_MEMBER");
  }
  return { community, role };
}

export async function requireCommunityRole(
  userId: string,
  communityId: string,
  allowed: CommunityRole[],
): Promise<{ community: CommunityRow; role: CommunityRole }> {
  const membership = await requireMember(userId, communityId);
  if (!allowed.includes(membership.role)) {
    throw apiErrors.forbidden("Недостаточно прав для этого действия", "FORBIDDEN_ROLE");
  }
  return membership;
}

export async function requirePlatformAdmin(userId: string): Promise<void> {
  if (!(await isPlatformAdmin(userId))) {
    throw apiErrors.forbidden("Действие доступно только администратору платформы", "ADMIN_ONLY");
  }
}

// Чат, к которому у пользователя есть доступ. Чужой чат — 404, чтобы не раскрывать его существование.
export async function requireChatAccess(userId: string, chatId: string): Promise<ChatRow> {
  const allowed = must(await supabaseAdmin.rpc("can_access_chat", { p_user: userId, p_chat: chatId }));
  if (!allowed) throw apiErrors.notFound("Чат не найден");
  return must(await supabaseAdmin.from("chats").select("*").eq("id", chatId).maybeSingle(), "Чат не найден");
}

export async function getChannelRow(channelId: string): Promise<ChannelRow> {
  return must(
    await supabaseAdmin.from("channels").select("*").eq("id", channelId).maybeSingle(),
    "Канал не найден",
  );
}

// Канал читают участники сообщества
export async function requireChannelAccess(
  userId: string,
  channelId: string,
): Promise<{ channel: ChannelRow; role: CommunityRole }> {
  const channel = await getChannelRow(channelId);
  const role = await getMyRole(userId, channel.community_id);
  if (!role) throw apiErrors.notFound("Канал не найден");
  return { channel, role };
}

// Для WebSocket-подписок: есть ли у пользователя доступ к чату или каналу (без исключений).
// Те же правила, что у REST: чат — функция базы can_access_chat (место, членство, закрытые
// группы), канал — участие в его сообществе.
export async function hasTargetAccess(
  userId: string,
  target: { kind: "chat" | "channel"; id: string },
): Promise<boolean> {
  if (target.kind === "chat") {
    return must(await supabaseAdmin.rpc("can_access_chat", { p_user: userId, p_chat: target.id })) === true;
  }
  const channel = maybe(
    await supabaseAdmin.from("channels").select("community_id").eq("id", target.id).maybeSingle(),
  );
  if (!channel) return false;
  return (await getMyRole(userId, channel.community_id)) !== null;
}
