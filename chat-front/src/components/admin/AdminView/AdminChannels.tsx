import { useState } from "react";
import ChannelFormModal from "@/components/community/ChannelFormModal/ChannelFormModal";
import Button from "@/components/ui/Button/Button";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { useChannels, useDeleteChannel } from "@/hooks/api/useCommunities";
import { getErrorMessage } from "@/lib/api";
import type { Channel } from "@/types";
import styles from "./AdminView.module.css";

// Вкладка «Каналы»: создание, редактирование и удаление каналов (ТЗ, п. 5.4)
export default function AdminChannels() {
  const { communityId } = useCurrentCommunity();
  const { data: channels = [] } = useChannels(communityId);
  const deleteChannel = useDeleteChannel(communityId);
  // undefined — окно закрыто, null — создание нового, Channel — редактирование
  const [editing, setEditing] = useState<Channel | null | undefined>(undefined);

  const remove = (channel: Channel) => {
    if (window.confirm(`Удалить канал #${channel.name}? Сообщения канала станут недоступны.`)) {
      deleteChannel.mutate(channel.id, { onError: (err) => window.alert(getErrorMessage(err)) });
    }
  };

  return (
    <div className={styles.stack}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.cardTitle}>Управление каналами</h3>
        <Button size="sm" onClick={() => setEditing(null)}>
          + Создать канал
        </Button>
      </div>

      <ul className={styles.rows}>
        {channels.map((channel) => (
          <li key={channel.id} className={styles.row}>
            <span className={styles.channelEmoji} aria-hidden="true">
              {channel.emoji}
            </span>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>#{channel.name}</div>
              <div className={styles.rowMeta}>{channel.description}</div>
            </div>
            {channel.isAnnouncements && <span className={styles.announceBadge}>Объявления</span>}
            <div className={styles.rowActions}>
              <Button variant="neutral" size="xs" onClick={() => setEditing(channel)}>
                Изменить
              </Button>
              {/* #general — основной канал сообщества по ТЗ, его удалить нельзя */}
              <Button
                variant="danger"
                size="xs"
                onClick={() => remove(channel)}
                disabled={channel.name === "general"}
                title={channel.name === "general" ? "Основной канал удалить нельзя" : undefined}
              >
                Удалить
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {editing !== undefined && (
        <ChannelFormModal
          communityId={communityId}
          channel={editing ?? undefined}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
