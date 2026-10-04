"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, UserPlus } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import { useLeaveChat } from "@/hooks/api/useChats";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import { useAvailableChats } from "@/hooks/useAvailableChats";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { getChatEmoji } from "@/lib/placeChats";
import type { ChatRoomInfo } from "../chatRoom";
import ChatInvitesModal from "../ChatInvitesModal/ChatInvitesModal";
import ChatView from "../ChatView/ChatView";
import headerStyles from "../ChatHeader/ChatHeader.module.css";
import styles from "../ChannelScreen/ChannelScreen.module.css";

// Чат по месту: общий, городской, районный или чат учебного заведения.
// Список доступных чатов и доступ к сообщениям проверяет сервер; здесь чат ищется в этом списке.
export default function PlaceChatScreen({ placeChatId }: { placeChatId: string }) {
  const router = useRouter();
  const { communityId } = useCurrentCommunity();
  const { chats, chatsQuery } = useAvailableChats();
  const chat = chats.find((item) => item.id === placeChatId);
  const leaveChat = useLeaveChat();
  const [isManageOpen, setIsManageOpen] = useState(false);
  const backHref = `/${communityId}/chat/general`;

  if (chatsQuery.isLoading) return null;

  if (!chat) {
    return (
      <div className={styles.notFound}>
        <EmptyState
          emoji="🔒"
          title="Этот чат вам недоступен"
          text="Чаты города, района и учебного заведения открываются по данным профиля, закрытые группы — по коду приглашения"
          action={<Button href={`/${communityId}/profile`}>Открыть профиль</Button>}
        />
      </div>
    );
  }

  const room: ChatRoomInfo = {
    target: { kind: "chat", id: chat.id },
    title: chat.name,
    emoji: getChatEmoji(chat),
    description: chat.description ?? "",
    placeholder: `Написать в чат «${chat.name}»...`,
    canPost: true,
    readOnlyNote: "",
    membersHref: null,
  };

  const leave = () => {
    if (!window.confirm(`Покинуть группу «${chat.name}»? Вернуться можно будет только по новому коду.`)) return;
    leaveChat.mutate(chat.id, { onSuccess: () => router.push(backHref) });
  };

  // Создатель группы и admin управляют ею; участник закрытой группы может из неё выйти.
  // Кнопки — только интерфейс: права проверяет сервер.
  const headerActions = chat.canManage ? (
    <button
      type="button"
      className={headerStyles.iconButton}
      onClick={() => setIsManageOpen(true)}
      title={chat.access === "private" ? "Пригласить участников" : "Управление группой"}
      aria-label={chat.access === "private" ? "Пригласить участников" : "Управление группой"}
    >
      <UserPlus size={16} />
    </button>
  ) : chat.access === "private" ? (
    <button
      type="button"
      className={headerStyles.iconButton}
      onClick={leave}
      disabled={leaveChat.isPending}
      title="Покинуть группу"
      aria-label="Покинуть группу"
    >
      <LogOut size={16} />
    </button>
  ) : null;

  // key сбрасывает состояние (ответ, поиск, текст в поле) при переходе в другой чат
  return (
    <>
      <ChatView key={chat.id} room={room} communityId={communityId} headerActions={headerActions} />
      {isManageOpen && (
        <ChatInvitesModal
          chat={{ ...chat, emoji: getChatEmoji(chat) }}
          onClose={() => setIsManageOpen(false)}
          onDeleted={() => {
            setIsManageOpen(false);
            router.push(backHref);
          }}
        />
      )}
    </>
  );
}
