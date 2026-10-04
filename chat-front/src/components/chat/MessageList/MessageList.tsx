import { Fragment, useEffect, useRef } from "react";
import { formatDayLabel, isSameDayIso } from "@/lib/format";
import type { Id, Message } from "@/types";
import MessageItem from "../MessageItem/MessageItem";
import styles from "./MessageList.module.css";

interface MessageListProps {
  messages: Message[];
  isSearching: boolean;
  isLoading: boolean;
  loadError: string | null;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  onReply: (message: Message) => void;
  onReact: (messageId: Id, emoji: string) => void;
  onDelete: (messageId: Id) => void;
}

// Список сообщений канала или чата. История загружается частями по 50 («Показать более ранние»).
export default function MessageList({
  messages,
  isSearching,
  isLoading,
  loadError,
  hasOlder,
  isLoadingOlder,
  onLoadOlder,
  onReply,
  onReact,
  onDelete,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages.at(-1);

  // При открытии чата и после отправки своего сообщения прокручиваем список в самый низ
  const lastMessageId = lastMessage?.id;
  const isLastMine = lastMessage?.isMine === true;
  const hasScrolled = useRef(false);
  useEffect(() => {
    const list = listRef.current;
    if (!list || !lastMessageId) return;
    if (!hasScrolled.current || isLastMine) list.scrollTop = list.scrollHeight;
    hasScrolled.current = true;
  }, [lastMessageId, isLastMine]);

  if (messages.length === 0) {
    const [emoji, title, text] = loadError
      ? ["⚠️", "Не удалось загрузить сообщения", loadError]
      : isLoading
        ? ["💬", "Загрузка сообщений…", ""]
        : isSearching
          ? ["🔍", "Ничего не найдено", "Попробуй другой запрос"]
          : ["💬", "В этом чате пока нет сообщений", "Напиши первое сообщение!"];
    return (
      <div className={styles.empty}>
        <div className={styles.emptyEmoji} aria-hidden="true">
          {emoji}
        </div>
        <p className={styles.emptyTitle}>{title}</p>
        {text && <p className={styles.emptyText}>{text}</p>}
      </div>
    );
  }

  return (
    <div className={styles.list} ref={listRef} role="log" aria-live="polite" aria-label="Сообщения">
      {hasOlder && !isSearching && (
        <button type="button" className={styles.loadOlder} onClick={onLoadOlder} disabled={isLoadingOlder}>
          {isLoadingOlder ? "Загрузка…" : "Показать более ранние сообщения"}
        </button>
      )}
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const isNewDay = !previous || !isSameDayIso(previous.createdAt, message.createdAt);

        return (
          <Fragment key={message.id}>
            {isNewDay && (
              <div className={styles.dayDivider}>
                <span className={styles.dayLine} />
                <span className={styles.dayLabel}>{formatDayLabel(message.createdAt)}</span>
                <span className={styles.dayLine} />
              </div>
            )}
            <MessageItem message={message} onReply={onReply} onReact={onReact} onDelete={onDelete} />
          </Fragment>
        );
      })}
    </div>
  );
}
