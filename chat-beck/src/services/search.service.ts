// Глобальный поиск: сообщества, доступные чаты и сообщения — только там, куда у пользователя есть доступ

import { supabaseAdmin } from "../config/supabase";
import type { ChatDto, CommunityDto, MessageDto } from "../types/dto";
import { ANONYMOUS_AUTHOR } from "../utils/anonymity";
import { escapeLike, must } from "../utils/db";
import { listAvailableChats } from "./chat.service";
import { listCommunities } from "./community.service";

export interface SearchMessageDto extends Pick<MessageDto, "id" | "content" | "createdAt" | "author" | "isMine"> {
  placeName: string;
  href: string;
}

export interface SearchResultDto {
  communities: CommunityDto[];
  chats: ChatDto[];
  messages: SearchMessageDto[];
}

export async function search(userId: string, q: string): Promise<SearchResultDto> {
  const needle = q.toLowerCase();
  const [communities, placeChats, memberships] = await Promise.all([
    listCommunities(userId, { q }),
    listAvailableChats(userId),
    supabaseAdmin.from("community_members").select("community_id").eq("user_id", userId),
  ]);
  const myCommunityIds = must(memberships).map((row) => row.community_id);
  // Страница, внутри которой открывается чат по месту
  const homeCommunity = myCommunityIds[0] ?? null;

  const [channels, localChats] =
    myCommunityIds.length === 0
      ? [[], []]
      : await Promise.all([
          supabaseAdmin.from("channels").select("id, name, community_id").in("community_id", myCommunityIds).then(must),
          supabaseAdmin
            .from("chats")
            .select("id, name, community_id")
            .eq("type", "local")
            .in("community_id", myCommunityIds)
            .then(must),
        ]);

  const places = new Map<string, { name: string; href: string }>();
  for (const chat of placeChats) {
    places.set(`chat:${chat.id}`, {
      name: chat.name,
      href: homeCommunity ? `/${homeCommunity}/chat/place/${chat.id}` : "/communities",
    });
  }
  for (const chat of localChats) {
    places.set(`chat:${chat.id}`, { name: chat.name, href: `/${chat.community_id}/nearby/${chat.id}` });
  }
  for (const channel of channels) {
    places.set(`channel:${channel.id}`, { name: `#${channel.name}`, href: `/${channel.community_id}/chat/${channel.name}` });
  }

  const chatIds = [...placeChats.map((chat) => chat.id), ...localChats.map((chat) => chat.id)];
  const channelIds = channels.map((channel) => channel.id);
  const filters = [
    chatIds.length > 0 ? `chat_id.in.(${chatIds.join(",")})` : null,
    channelIds.length > 0 ? `channel_id.in.(${channelIds.join(",")})` : null,
  ].filter((filter): filter is string => filter !== null);

  const rows =
    filters.length === 0
      ? []
      : must(
          await supabaseAdmin
            .from("messages")
            .select("id, chat_id, channel_id, user_id, content, created_at")
            .or(filters.join(","))
            .ilike("content", `%${escapeLike(q)}%`)
            .order("created_at", { ascending: false })
            .limit(30),
        );

  return {
    communities: communities.slice(0, 10),
    chats: placeChats.filter((chat) => chat.name.toLowerCase().includes(needle)).slice(0, 10),
    messages: rows.flatMap((row) => {
      const place = places.get(row.chat_id ? `chat:${row.chat_id}` : `channel:${row.channel_id ?? ""}`);
      if (!place) return [];
      return [
        {
          id: row.id,
          content: row.content,
          createdAt: row.created_at,
          author: ANONYMOUS_AUTHOR,
          isMine: row.user_id === userId,
          placeName: place.name,
          href: place.href,
        },
      ];
    }),
  };
}
