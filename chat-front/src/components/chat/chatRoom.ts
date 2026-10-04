import type { MessageTarget } from "@/hooks/api/useMessages";

// Описание открытого чата для общей области сообщений.
// Один и тот же ChatView показывает и каналы сообщества, и чаты по месту (город, район, школа).
export interface ChatRoomInfo {
  target: MessageTarget;
  title: string; // «#general» или «Город: Бишкек»
  emoji: string;
  description: string;
  placeholder: string; // подсказка в поле ввода: «Написать в #general...»
  canPost: boolean; // например, в #announcements пишут только модераторы
  readOnlyNote: string; // что показать вместо поля ввода, если писать нельзя
  membersHref: string | null; // кнопка «Участники» в шапке (у чатов по месту её нет)
}
