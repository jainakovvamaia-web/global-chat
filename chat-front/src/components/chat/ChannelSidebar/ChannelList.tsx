import Link from "next/link";
import { useParams } from "next/navigation";
import { Bookmark } from "lucide-react";
import type { Channel } from "@/types";
import styles from "./ChannelSidebar.module.css";

interface ChannelListProps {
  communityId: string;
  channels: Channel[];
  onNavigate: () => void;
}

export default function ChannelList({ communityId, channels, onNavigate }: ChannelListProps) {
  const { channelName } = useParams<{ channelName?: string }>();

  return (
    <ul className={styles.channelList}>
      {channels.map((channel) => {
        const isActive = channel.name === channelName;
        const unread = channel.unreadCount;

        return (
          <li key={channel.id}>
            <Link
              href={`/${communityId}/chat/${channel.name}`}
              className={`${styles.channel} ${isActive ? styles.channelActive : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={onNavigate}
            >
              <span className={styles.channelEmoji} aria-hidden="true">
                {channel.emoji}
              </span>
              <span className={`${styles.channelName} ${unread ? styles.channelNameUnread : ""}`}>
                #{channel.name}
              </span>
              {channel.isPinned && (
                <Bookmark size={12} className={styles.pinIcon} aria-label="Закреплён" />
              )}
              {unread > 0 && (
                <span className={styles.unreadBadge} aria-label={`${unread} непрочитанных`}>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
