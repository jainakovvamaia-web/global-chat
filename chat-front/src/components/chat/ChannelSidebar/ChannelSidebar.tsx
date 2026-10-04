"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleUser, Plus } from "lucide-react";
import ChannelFormModal from "@/components/community/ChannelFormModal/ChannelFormModal";
import { AnonymousAvatar } from "@/components/ui/Avatar/Avatar";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { canManageCommunity, useChannels } from "@/hooks/api/useCommunities";
import { useRealtimeTopics } from "@/hooks/useRealtime";
import { useUiStore } from "@/store/useUiStore";
import ChannelList from "./ChannelList";
import CommunitySwitcher from "./CommunitySwitcher";
import PlaceChatList from "./PlaceChatList";
import styles from "./ChannelSidebar.module.css";

// Вторая колонка: сообщество, каналы, чаты по месту из профиля и ссылка на свой профиль.
// На десктопе всегда видна, на телефоне выезжает слева по кнопке в шапке чата.
export default function ChannelSidebar() {
  const { communityId, community, myRole } = useCurrentCommunity();
  const channelsQuery = useChannels(communityId, community?.joined === true);
  const isDrawerOpen = useUiStore((state) => state.isChannelDrawerOpen);
  const closeDrawer = useUiStore((state) => state.closeChannelDrawer);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const channels = channelsQuery.data ?? [];
  // Все каналы сообщества слушаем через то же WebSocket-соединение — счётчики непрочитанных
  // обновляются сразу, без перезапроса списка
  useRealtimeTopics(channels.map((channel) => ({ kind: "channel" as const, id: channel.id })));

  if (!community) return null;

  return (
    <>
      {isDrawerOpen && <div className={styles.backdrop} onClick={closeDrawer} aria-hidden="true" />}

      <aside
        className={`${styles.sidebar} ${isDrawerOpen ? styles.open : ""}`}
        aria-label="Каналы сообщества"
      >
        <CommunitySwitcher community={community} />

        <div className={styles.scroll}>
          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <span className={styles.groupTitle}>Каналы</span>
              {/* По ТЗ создавать каналы могут администраторы */}
              {canManageCommunity(myRole) && (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setIsCreateOpen(true)}
                  title="Создать канал"
                  aria-label="Создать канал"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
            <ChannelList communityId={communityId} channels={channels} onNavigate={closeDrawer} />
          </div>

          {/* Чаты по месту: разделы «Общие», город/район и учебное заведение строятся из данных */}
          <PlaceChatList communityId={communityId} onNavigate={closeDrawer} />
        </div>

        <div className={styles.userBar}>
          {/* В чатах вы тоже анонимны — личные данные видны только в профиле */}
          <AnonymousAvatar size="sm" isOnline />
          <div className={styles.userText}>
            <div className={styles.userName}>Анонимно</div>
            <div className={styles.userHandle}>Так вас видят в чатах</div>
          </div>
          <Link
            href={`/${communityId}/profile`}
            className={styles.iconButton}
            title="Мой профиль"
            aria-label="Мой профиль"
            onClick={closeDrawer}
          >
            <CircleUser size={16} />
          </Link>
        </div>
      </aside>

      {isCreateOpen && <ChannelFormModal communityId={communityId} onClose={() => setIsCreateOpen(false)} />}
    </>
  );
}
