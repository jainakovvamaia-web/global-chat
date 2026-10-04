import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import PrivateAccessModal from "@/components/community/PrivateAccessModal/PrivateAccessModal";
import { useAvailableChats } from "@/hooks/useAvailableChats";
import CreateChatModal from "../CreateChatModal/CreateChatModal";
import { getChatEmoji, groupAvailableChats } from "@/lib/placeChats";
import styles from "./ChannelSidebar.module.css";

interface PlaceChatListProps {
  communityId: string;
  onNavigate: () => void;
}

// «Мои чаты»: список доступных чатов приходит с сервера — компонент просто выводит его циклом.
// После смены места или учёбы в профиле список перезапрашивается.
export default function PlaceChatList({ communityId, onNavigate }: PlaceChatListProps) {
  const { placeChatId } = useParams<{ placeChatId?: string }>();
  const { profile, chats } = useAvailableChats();
  const sections = groupAvailableChats(chats, profile?.locationNames);
  const activeId = placeChatId ? decodeURIComponent(placeChatId) : null;
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  // Кнопка только для показа: создать группу сервер всё равно разрешит лишь admin
  const isAdmin = profile?.role === "admin";

  return (
    <>
      <div className={styles.group}>
        <div className={styles.groupHeader}>
          <span className={styles.groupTitle}>Мои чаты</span>
          <span className={styles.groupActions}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setIsJoinOpen(true)}
              title="Ввести код приглашения"
              aria-label="Ввести код приглашения"
            >
              <KeyRound size={14} />
            </button>
            {isAdmin && (
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setIsCreateOpen(true)}
                title="Создать группу"
                aria-label="Создать группу"
              >
                <Plus size={14} />
              </button>
            )}
          </span>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.key} className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.groupTitle}>
              <span aria-hidden="true">{section.emoji}</span> {section.title}
            </span>
          </div>

          {section.blocks.map((block) => (
            <div key={block.subtitle ?? "main"} className={block.subtitle ? styles.subgroup : undefined}>
              {block.subtitle && <div className={styles.subgroupTitle}>{block.subtitle}</div>}
              <ul className={styles.channelList}>
                {block.chats.map((chat) => {
                  const isActive = activeId === chat.id;
                  return (
                    <li key={chat.id}>
                      <Link
                        href={`/${communityId}/chat/place/${encodeURIComponent(chat.id)}`}
                        className={`${styles.channel} ${isActive ? styles.channelActive : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        <span className={styles.channelEmoji} aria-hidden="true">
                          {getChatEmoji(chat)}
                        </span>
                        <span className={styles.channelName}>{chat.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {profile && !profile.location.districtId && (
        <Link href={`/${communityId}/profile`} className={styles.emptyHint} onClick={onNavigate}>
          Укажите город и район в профиле, чтобы появились чаты района и учебного заведения →
        </Link>
      )}

      {isCreateOpen && <CreateChatModal communityId={communityId} onClose={() => setIsCreateOpen(false)} />}
      {isJoinOpen && <PrivateAccessModal community={null} onClose={() => setIsJoinOpen(false)} />}
    </>
  );
}
