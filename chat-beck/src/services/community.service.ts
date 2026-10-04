// Сообщества: каталог, вступление, участники (анонимно), роли, приглашения, статистика

import { createHmac } from "node:crypto";
import { env } from "../config/env";
import { supabaseAdmin } from "../config/supabase";
import type { CommunityRole, CommunityRow } from "../types/database.types";
import type { CommunityDto, CommunityStatsDto, InvitationDto, MemberDto } from "../types/dto";
import { apiErrors } from "../utils/apiErrors";
import { check, countOf, escapeLike, must } from "../utils/db";
import { ANONYMOUS_NAME } from "../utils/anonymity";
import { generateInviteCode, redeemError, toInvitationDto } from "../utils/invitations";
import type { CreateCommunityInput, UpdateCommunityInput } from "../validators/community.validators";
import {
  getCommunityRow,
  getMyRole,
  MANAGER_ROLES,
  requireCommunityRole,
  requireMember,
  requirePlatformAdmin,
} from "./access.service";
import { addAudit } from "./audit.service";
import { closeTopic, revalidateAccess } from "../realtime/realtime.service";
import { notifyUsers } from "./notification.service";
import { isOnline } from "./user.service";

const ROLE_LABELS: Record<CommunityRole, string> = {
  owner: "Владелец",
  admin: "Администратор",
  moderator: "Модератор",
  member: "Участник",
};

// Каналы, которые получает каждое новое сообщество
const DEFAULT_CHANNELS = [
  { name: "general", emoji: "💬", description: "Общий чат для всех", is_announcements: false, is_pinned: false },
  { name: "announcements", emoji: "📢", description: "Важные объявления", is_announcements: true, is_pinned: true },
  { name: "lost-and-found", emoji: "🔍", description: "Потерянные и найденные вещи", is_announcements: false, is_pinned: false },
  { name: "events", emoji: "🎉", description: "Мероприятия сообщества", is_announcements: false, is_pinned: false },
  { name: "memes", emoji: "😂", description: "Мемы и развлечения", is_announcements: false, is_pinned: false },
  { name: "study", emoji: "📚", description: "Учёба и помощь", is_announcements: false, is_pinned: false },
];

// ── Анонимный идентификатор участника ────────────────────────────────────────
// Настоящий user_id наружу не отдаём. memberId — HMAC от (сообщество, пользователь) с серверным
// секретом: он стабилен (можно назначить роль), но по нему нельзя узнать пользователя
// и нельзя сопоставить одного человека в разных сообществах.
function toMemberId(communityId: string, userId: string): string {
  return createHmac("sha256", env.MEMBER_ID_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`member:${communityId}:${userId}`)
    .digest("hex")
    .slice(0, 24);
}

async function resolveMember(communityId: string, memberId: string): Promise<{ userId: string; role: CommunityRole }> {
  const members = must(
    await supabaseAdmin.from("community_members").select("user_id, role").eq("community_id", communityId),
  );
  const found = members.find((member) => toMemberId(communityId, member.user_id) === memberId);
  if (!found) throw apiErrors.notFound("Участник не найден");
  return { userId: found.user_id, role: found.role };
}

// ── Каталог ──────────────────────────────────────────────────────────────────

async function toCommunityDtos(userId: string, rows: CommunityRow[]): Promise<CommunityDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [counts, memberships, requests] = await Promise.all([
    supabaseAdmin.rpc("community_counts", { p_communities: ids }),
    supabaseAdmin.from("community_members").select("community_id, role").eq("user_id", userId).in("community_id", ids),
    supabaseAdmin.from("join_requests").select("community_id").eq("user_id", userId).in("community_id", ids),
  ]);
  const countById = new Map(must(counts).map((row) => [row.community_id, row]));
  const roleById = new Map(must(memberships).map((row) => [row.community_id, row.role]));
  const requested = new Set(must(requests).map((row) => row.community_id));

  return rows.map((row) => ({
    id: row.id,
    cityId: row.city_id,
    name: row.name,
    category: row.category,
    description: row.description,
    emoji: row.emoji,
    isPrivate: row.is_private,
    membersCount: countById.get(row.id)?.members_count ?? 0,
    onlineCount: countById.get(row.id)?.online_count ?? 0,
    joined: roleById.has(row.id),
    myRole: roleById.get(row.id) ?? null,
    requested: requested.has(row.id),
  }));
}

export async function listCommunities(
  userId: string,
  filters: { joined?: boolean | undefined; q?: string | undefined },
): Promise<CommunityDto[]> {
  let query = supabaseAdmin.from("communities").select("*").order("created_at");
  if (filters.q) query = query.ilike("name", `%${escapeLike(filters.q)}%`);
  const dtos = await toCommunityDtos(userId, must(await query));
  return filters.joined ? dtos.filter((item) => item.joined) : dtos;
}

export async function getCommunity(userId: string, communityId: string): Promise<CommunityDto> {
  const [dto] = await toCommunityDtos(userId, [await getCommunityRow(communityId)]);
  if (!dto) throw apiErrors.notFound("Сообщество не найдено");
  return dto;
}

// Создавать сообщества может только администратор платформы (роль проверяется по базе)
export async function createCommunity(userId: string, input: CreateCommunityInput): Promise<CommunityDto> {
  await requirePlatformAdmin(userId);
  const profile = must(await supabaseAdmin.from("profiles").select("city_id").eq("id", userId).maybeSingle());
  const community = must(
    await supabaseAdmin
      .from("communities")
      .insert({
        name: input.name,
        category: input.category,
        description: input.description,
        emoji: input.emoji,
        is_private: input.isPrivate,
        city_id: profile.city_id, // город создателя
        created_by: userId,
      })
      .select("*")
      .single(),
  );
  check(await supabaseAdmin.from("community_members").insert({ community_id: community.id, user_id: userId, role: "owner" }));
  check(await supabaseAdmin.from("channels").insert(DEFAULT_CHANNELS.map((channel) => ({ ...channel, community_id: community.id }))));
  await addAudit(community.id, `Сообщество «${community.name}» создано`);
  return getCommunity(userId, community.id);
}

export async function updateCommunity(userId: string, communityId: string, input: UpdateCommunityInput): Promise<CommunityDto> {
  await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  const patch: Partial<CommunityRow> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description;
  if (input.emoji !== undefined) patch.emoji = input.emoji;
  if (input.isPrivate !== undefined) patch.is_private = input.isPrivate;
  check(await supabaseAdmin.from("communities").update(patch).eq("id", communityId));
  await addAudit(communityId, "Изменены настройки сообщества");
  return getCommunity(userId, communityId);
}

// Удалить сообщество может только владелец — вместе с каналами и сообщениями (каскад)
export async function deleteCommunity(userId: string, communityId: string): Promise<void> {
  await requireCommunityRole(userId, communityId, ["owner"]);
  // Каналы и чаты удалятся каскадом — заранее запоминаем их, чтобы отписать слушателей
  const [channels, localChats] = await Promise.all([
    supabaseAdmin.from("channels").select("id").eq("community_id", communityId).then(must),
    supabaseAdmin.from("chats").select("id").eq("community_id", communityId).then(must),
  ]);
  check(await supabaseAdmin.from("communities").delete().eq("id", communityId));
  for (const channel of channels) closeTopic({ kind: "channel", id: channel.id });
  for (const chat of localChats) closeTopic({ kind: "chat", id: chat.id });
}

// ── Вступление ───────────────────────────────────────────────────────────────

async function addMember(userId: string, communityId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("community_members")
    .insert({ community_id: communityId, user_id: userId, role: "member" });
  if (error && error.code !== "23505") check({ error }); // уже участник — не ошибка
  if (!error) {
    await supabaseAdmin.from("join_requests").delete().eq("community_id", communityId).eq("user_id", userId);
    await addAudit(communityId, "В сообщество вступил новый участник");
  }
}

export async function joinCommunity(userId: string, communityId: string): Promise<CommunityDto> {
  const community = await getCommunityRow(communityId);
  if (community.is_private && !(await getMyRole(userId, communityId))) {
    throw apiErrors.forbidden("Закрытое сообщество: нужен код приглашения или заявка", "PRIVATE_COMMUNITY");
  }
  await addMember(userId, communityId);
  return getCommunity(userId, communityId);
}

// Убрать человека из сообщества вместе с его участием в локальных чатах «Рядом» этого сообщества
async function dropMembership(userId: string, communityId: string): Promise<void> {
  check(await supabaseAdmin.from("community_members").delete().eq("community_id", communityId).eq("user_id", userId));
  const localChats = must(
    await supabaseAdmin.from("chats").select("id").eq("type", "local").eq("community_id", communityId),
  );
  if (localChats.length > 0) {
    check(
      await supabaseAdmin
        .from("chat_members")
        .delete()
        .eq("user_id", userId)
        .in("chat_id", localChats.map((chat) => chat.id)),
    );
  }
  revalidateAccess(userId); // каналы и чаты «Рядом» этого сообщества больше не приходят по WebSocket
}

export async function leaveCommunity(userId: string, communityId: string): Promise<void> {
  const { role } = await requireMember(userId, communityId);
  if (role === "owner") throw apiErrors.badRequest("Владелец не может покинуть сообщество", "OWNER_CANNOT_LEAVE");
  await dropMembership(userId, communityId);
}

export async function requestAccess(userId: string, communityId: string): Promise<CommunityDto> {
  const community = await getCommunityRow(communityId);
  if (!community.is_private) throw apiErrors.badRequest("Сообщество открытое — можно просто вступить");
  if (await getMyRole(userId, communityId)) throw apiErrors.conflict("Вы уже участник", "ALREADY_MEMBER");
  const { error } = await supabaseAdmin.from("join_requests").insert({ community_id: communityId, user_id: userId });
  if (error && error.code !== "23505") check({ error });
  if (!error) await addAudit(communityId, "Новая заявка на вступление");
  return getCommunity(userId, communityId);
}

// Вход в сообщество по коду (окно закрытого сообщества). Код проверяется и используется в базе
// одной транзакцией (redeem_invitation): срок, отзыв и лимит нельзя обойти одновременными запросами.
// Повторный вход уже участника не ошибка — просто открываем сообщество.
export async function joinByCode(userId: string, code: string): Promise<CommunityDto> {
  const [result] = must(
    await supabaseAdmin.rpc("redeem_invitation", { p_code: code, p_user: userId, p_kind: "community" }),
  );
  if (!result || !result.community_id) throw redeemError("not_found", "community");
  if (result.status !== "joined" && result.status !== "already_member") throw redeemError(result.status, "community");
  if (result.status === "joined") await addAudit(result.community_id, "Новый участник вступил по коду приглашения");
  return getCommunity(userId, result.community_id);
}

// Заявки видят администраторы — тоже анонимно
export async function listJoinRequests(userId: string, communityId: string): Promise<{ requestId: string; createdAt: string }[]> {
  await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  const rows = must(await supabaseAdmin.from("join_requests").select("*").eq("community_id", communityId).order("created_at"));
  return rows.map((row) => ({ requestId: toMemberId(communityId, row.user_id), createdAt: row.created_at }));
}

export async function answerJoinRequest(userId: string, communityId: string, requestId: string, approve: boolean): Promise<void> {
  await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  const rows = must(await supabaseAdmin.from("join_requests").select("user_id").eq("community_id", communityId));
  const request = rows.find((row) => toMemberId(communityId, row.user_id) === requestId);
  if (!request) throw apiErrors.notFound("Заявка не найдена");
  if (approve) {
    await addMember(request.user_id, communityId);
    const community = await getCommunityRow(communityId);
    try {
      await notifyUsers([request.user_id], "invite", {
        title: "Заявка одобрена",
        text: `Вас приняли в сообщество «${community.name}»`,
        hrefFor: async () => `/${communityId}/chat/general`,
      });
    } catch (error) {
      console.error("Не удалось уведомить об одобрении заявки:", error);
    }
  } else {
    check(await supabaseAdmin.from("join_requests").delete().eq("community_id", communityId).eq("user_id", request.user_id));
  }
}

// ── Участники ────────────────────────────────────────────────────────────────

export async function listMembers(userId: string, communityId: string): Promise<MemberDto[]> {
  await requireMember(userId, communityId);
  const members = must(
    await supabaseAdmin.from("community_members").select("*").eq("community_id", communityId).order("joined_at"),
  );
  const seen = must(
    await supabaseAdmin
      .from("profiles")
      .select("id, last_seen_at, settings")
      .in("id", members.map((member) => member.user_id)),
  );
  const presence = new Map(seen.map((row) => [row.id, row]));
  const order: Record<CommunityRole, number> = { owner: 0, admin: 1, moderator: 2, member: 3 };

  return members
    .map((member) => ({
      memberId: toMemberId(communityId, member.user_id),
      displayName: ANONYMOUS_NAME,
      role: member.role,
      isOnline: isOnline(presence.get(member.user_id)?.last_seen_at ?? null, presence.get(member.user_id)?.settings),
      isSelf: member.user_id === userId,
      joinedAt: member.joined_at,
    }))
    .sort((a, b) => order[a.role] - order[b.role]);
}

export async function setMemberRole(
  userId: string,
  communityId: string,
  memberId: string,
  role: Exclude<CommunityRole, "owner">,
): Promise<void> {
  const actor = await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  const target = await resolveMember(communityId, memberId);
  if (target.userId === userId) throw apiErrors.forbidden("Нельзя менять свою роль", "SELF_ROLE");
  if (target.role === "owner") throw apiErrors.forbidden("Роль владельца изменить нельзя", "OWNER_ROLE");
  // Администратор не может повышать до администратора и понижать других администраторов — только владелец
  if (actor.role !== "owner" && (target.role === "admin" || role === "admin")) {
    throw apiErrors.forbidden("Это может сделать только владелец", "OWNER_ONLY");
  }
  if (target.role === role) return;
  check(
    await supabaseAdmin
      .from("community_members")
      .update({ role })
      .eq("community_id", communityId)
      .eq("user_id", target.userId),
  );
  await addAudit(communityId, `Участнику назначена роль «${ROLE_LABELS[role]}»`);
}

export async function removeMember(userId: string, communityId: string, memberId: string): Promise<void> {
  const actor = await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  const target = await resolveMember(communityId, memberId);
  if (target.userId === userId) throw apiErrors.forbidden("Чтобы выйти, используйте «Покинуть сообщество»");
  if (target.role === "owner") throw apiErrors.forbidden("Владельца удалить нельзя", "OWNER_ROLE");
  if (target.role === "admin" && actor.role !== "owner") {
    throw apiErrors.forbidden("Администратора может удалить только владелец", "OWNER_ONLY");
  }
  await dropMembership(target.userId, communityId);
  await addAudit(communityId, "Участник удалён из сообщества");
}

// ── Приглашения ──────────────────────────────────────────────────────────────
// Код действует ограниченное время и (по желанию) ограниченное число раз; его можно отозвать.

const INVITE_DAYS_DEFAULT = 7;

export async function createInvitation(
  userId: string,
  communityId: string,
  options: { expiresInDays?: number | null | undefined; maxUses?: number | null | undefined } = {},
): Promise<InvitationDto> {
  const { community } = await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  const code = generateInviteCode(community.name);
  const days = options.expiresInDays === undefined ? INVITE_DAYS_DEFAULT : options.expiresInDays;
  const row = must(
    await supabaseAdmin
      .from("invitations")
      .insert({
        code,
        community_id: communityId,
        created_by: userId,
        expires_at: days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString(),
        max_uses: options.maxUses ?? null,
      })
      .select("*")
      .single(),
  );
  await addAudit(communityId, `Создан код приглашения ${code}`);
  return toInvitationDto(row);
}

export async function listInvitations(userId: string, communityId: string): Promise<InvitationDto[]> {
  await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  const rows = must(
    await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("community_id", communityId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  );
  return rows.map(toInvitationDto);
}

export async function revokeInvitation(userId: string, communityId: string, code: string): Promise<void> {
  await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  const row = must(
    await supabaseAdmin
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("community_id", communityId)
      .eq("code", code)
      .is("revoked_at", null)
      .select("code")
      .maybeSingle(),
    "Код приглашения не найден",
  );
  await addAudit(communityId, `Отозван код приглашения ${row.code}`);
}

// ── Статистика для админки ───────────────────────────────────────────────────

export async function getStats(userId: string, communityId: string): Promise<CommunityStatsDto> {
  await requireCommunityRole(userId, communityId, ["owner", "admin", "moderator"]);
  const [counts, channels, weekly] = await Promise.all([
    supabaseAdmin.rpc("community_counts", { p_communities: [communityId] }),
    supabaseAdmin.from("channels").select("id", { count: "exact", head: true }).eq("community_id", communityId),
    supabaseAdmin.rpc("community_weekly_messages", { p_community: communityId }),
  ]);
  const row = must(counts)[0];
  return {
    membersCount: row?.members_count ?? 0,
    onlineCount: row?.online_count ?? 0,
    channelsCount: countOf(channels),
    weeklyMessages: must(weekly),
  };
}
