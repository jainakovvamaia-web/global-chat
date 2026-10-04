"use client";

import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { canModerate, useChannels } from "@/hooks/api/useCommunities";
import type { ChatRoomInfo } from "../chatRoom";
import ChatView from "../ChatView/ChatView";
import styles from "./ChannelScreen.module.css";

// Находит канал по названию из адреса и показывает его чат
export default function ChannelScreen({ channelName }: { channelName: string }) {
  const { communityId, myRole } = useCurrentCommunity();
  const channelsQuery = useChannels(communityId);
  const channel = channelsQuery.data?.find((item) => item.name === channelName);

  if (channelsQuery.isLoading) return null;

  if (!channel) {
    return (
      <div className={styles.notFound}>
        <EmptyState
          emoji="🤷"
          title={`Канала #${channelName} нет`}
          text="Возможно, его удалили или переименовали"
          action={<Button href={`/${communityId}/chat/general`}>Перейти в #general</Button>}
        />
      </div>
    );
  }

  const room: ChatRoomInfo = {
    target: { kind: "channel", id: channel.id },
    title: `#${channel.name}`,
    emoji: channel.emoji,
    description: channel.description,
    placeholder: `Написать в #${channel.name}...`,
    // По ТЗ в канале объявлений писать могут только администраторы и модераторы
    canPost: !channel.isAnnouncements || canModerate(myRole),
    readOnlyNote: "📢 Публиковать в этом канале могут только администраторы и модераторы",
    membersHref: `/${communityId}/members`,
  };

  // key сбрасывает состояние (ответ, поиск, текст в поле) при переходе в другой канал
  return <ChatView key={channel.id} room={room} communityId={communityId} />;
}
