import { useChats } from "@/hooks/api/useChats";
import { useProfile } from "@/hooks/api/useProfile";

// Чаты по месту, доступные текущему пользователю. Список решает сервер по профилю:
// после смены города/района/заведения он перезапрашивается (инвалидация в useUpdateProfile).
export function useAvailableChats() {
  const { data: profile } = useProfile();
  const chatsQuery = useChats();
  return { profile, chats: chatsQuery.data ?? [], chatsQuery };
}
