// Каналы сообщества (#general, #announcements, ...)

import { supabaseAdmin } from "../config/supabase";
import type { ChannelRow } from "../types/database.types";
import type { ChannelDto } from "../types/dto";
import { apiErrors } from "../utils/apiErrors";
import { check, must } from "../utils/db";
import type { ChannelInput } from "../validators/community.validators";
import { getChannelRow, MANAGER_ROLES, requireChannelAccess, requireCommunityRole, requireMember } from "./access.service";
import { addAudit } from "./audit.service";
import { closeTopic } from "../realtime/realtime.service";

const toChannelDto = (row: ChannelRow, unreadCount: number): ChannelDto => ({
  id: row.id,
  communityId: row.community_id,
  name: row.name,
  description: row.description,
  emoji: row.emoji,
  isAnnouncements: row.is_announcements,
  isPinned: row.is_pinned,
  unreadCount,
});

export async function listChannels(userId: string, communityId: string): Promise<ChannelDto[]> {
  await requireMember(userId, communityId);
  const [channels, unread] = await Promise.all([
    supabaseAdmin.from("channels").select("*").eq("community_id", communityId).order("created_at"),
    supabaseAdmin.rpc("channel_unread_counts", { p_user: userId, p_community: communityId }),
  ]);
  const unreadById = new Map(must(unread).map((row) => [row.channel_id, row.unread_count]));
  return must(channels)
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))
    .map((row) => toChannelDto(row, unreadById.get(row.id) ?? 0));
}

// Понятная ошибка вместо «Такая запись уже существует»
async function assertNameFree(communityId: string, name: string, exceptId?: string): Promise<void> {
  let query = supabaseAdmin
    .from("channels")
    .select("id", { count: "exact", head: true })
    .eq("community_id", communityId)
    .eq("name", name);
  if (exceptId) query = query.neq("id", exceptId);
  const { count } = await query;
  if ((count ?? 0) > 0) throw apiErrors.conflict(`Канал #${name} уже существует`, "CHANNEL_EXISTS");
}

export async function createChannel(userId: string, communityId: string, input: ChannelInput): Promise<ChannelDto> {
  await requireCommunityRole(userId, communityId, MANAGER_ROLES);
  await assertNameFree(communityId, input.name);
  const row = must(
    await supabaseAdmin
      .from("channels")
      .insert({
        community_id: communityId,
        name: input.name,
        description: input.description,
        emoji: input.emoji,
        is_announcements: input.isAnnouncements,
        is_pinned: input.isPinned ?? false,
      })
      .select("*")
      .single(),
  );
  await addAudit(communityId, `Создан канал #${row.name}`);
  return toChannelDto(row, 0);
}

export async function updateChannel(userId: string, channelId: string, input: ChannelInput): Promise<ChannelDto> {
  const channel = await getChannelRow(channelId);
  await requireCommunityRole(userId, channel.community_id, MANAGER_ROLES);
  await assertNameFree(channel.community_id, input.name, channelId);
  const patch: Partial<ChannelRow> = {
    name: input.name,
    description: input.description,
    emoji: input.emoji,
    is_announcements: input.isAnnouncements,
  };
  if (input.isPinned !== undefined) patch.is_pinned = input.isPinned;
  const row = must(await supabaseAdmin.from("channels").update(patch).eq("id", channelId).select("*").single());
  await addAudit(channel.community_id, `Изменён канал #${row.name}`);
  return toChannelDto(row, 0);
}

export async function deleteChannel(userId: string, channelId: string): Promise<void> {
  const channel = await getChannelRow(channelId);
  await requireCommunityRole(userId, channel.community_id, MANAGER_ROLES);
  check(await supabaseAdmin.from("channels").delete().eq("id", channelId));
  closeTopic({ kind: "channel", id: channelId });
  await addAudit(channel.community_id, `Удалён канал #${channel.name}`);
}

export async function markChannelRead(userId: string, channelId: string): Promise<void> {
  await requireChannelAccess(userId, channelId);
  check(
    await supabaseAdmin
      .from("channel_reads")
      .upsert({ user_id: userId, channel_id: channelId, last_read_at: new Date().toISOString() }),
  );
}
