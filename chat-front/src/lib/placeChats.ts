// Раскладка доступных чатов по разделам «Мои чаты».
// Какие чаты доступны, решает сервер (GET /api/chats) — здесь только группировка для показа.

import type { PlaceChat, PlaceChatType, Profile } from "@/types";

const DEFAULT_EMOJI: Record<PlaceChatType, string> = {
  general: "🌐",
  city: "🏙️",
  district: "💬",
  university: "💬",
  school: "💬",
};

export const getChatEmoji = (chat: PlaceChat) => chat.emoji ?? DEFAULT_EMOJI[chat.type];

// Раздел списка «Мои чаты» и блоки внутри него (блок может иметь подзаголовок — район или заведение)
export interface ChatBlock {
  subtitle: string | null;
  chats: PlaceChat[];
}

export interface ChatSection {
  key: string;
  title: string;
  emoji: string;
  blocks: ChatBlock[];
}

// 🌐 Общие → 📍 Город (чаты города + блок района) → 🎓 Моё учебное заведение → 🔒 Закрытые группы.
// Закрытые группы (по приглашению) идут отдельным разделом: они могут быть из другого района.
// Пустые блоки и разделы не показываются.
export function groupAvailableChats(chats: PlaceChat[], names: Profile["locationNames"] | undefined): ChatSection[] {
  const open = chats.filter((chat) => chat.access !== "private");
  const byType = (...types: PlaceChatType[]) => open.filter((chat) => types.includes(chat.type));

  const sections: ChatSection[] = [
    { key: "general", title: "Общие", emoji: "🌐", blocks: [{ subtitle: null, chats: byType("general") }] },
    {
      key: "city",
      title: names?.city ?? "Мой город",
      emoji: "📍",
      blocks: [
        { subtitle: null, chats: byType("city") },
        { subtitle: names?.district ?? null, chats: byType("district") },
      ],
    },
    {
      key: "institution",
      title: "Моё учебное заведение",
      emoji: "🎓",
      blocks: [{ subtitle: names?.institution ?? null, chats: byType("university", "school") }],
    },
    {
      key: "private",
      title: "Закрытые группы",
      emoji: "🔒",
      blocks: [{ subtitle: null, chats: chats.filter((chat) => chat.access === "private") }],
    },
  ];

  return sections
    .map((section) => ({ ...section, blocks: section.blocks.filter((block) => block.chats.length > 0) }))
    .filter((section) => section.blocks.length > 0);
}
