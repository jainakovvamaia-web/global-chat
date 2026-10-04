import { useCallback, useRef, useState } from "react";
import { Copy, Ellipsis, Plus, Reply, Trash } from "lucide-react";
import { AnonymousAvatar } from "@/components/ui/Avatar/Avatar";
import EmojiPicker from "@/components/ui/EmojiPicker/EmojiPicker";
import { useDismiss } from "@/hooks/useDismiss";
import { formatTime } from "@/lib/format";
import type { Id, Message } from "@/types";
import MessageText from "./MessageText";
import styles from "./MessageItem.module.css";

const HOVER_REACTIONS = ["😊", "👍", "❤️"];

interface MessageItemProps {
  message: Message; // автор всегда «Анонимно»; isMine сервер вычисляет по сессии
  onReply: (message: Message) => void;
  onReact: (messageId: Id, emoji: string) => void;
  onDelete: (messageId: Id) => void;
}

type OpenPopup = "picker" | "menu" | null;

export default function MessageItem({ message, onReply, onReact, onDelete }: MessageItemProps) {
  const author = message.author;
  const replyTo = message.replyTo;

  const [openPopup, setOpenPopup] = useState<OpenPopup>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const closePopup = useCallback(() => setOpenPopup(null), []);
  useDismiss(popupRef, openPopup !== null, closePopup);

  if (message.type === "system") {
    return (
      <div className={styles.system}>
        {/* Системные сообщения безличные — автора у них нет */}
        <span className={styles.systemText}>{message.content}</span>
      </div>
    );
  }

  const isMine = message.isMine;

  const react = (emoji: string) => {
    onReact(message.id, emoji);
    closePopup();
  };

  const copyText = async () => {
    closePopup();
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      // Буфер обмена может быть недоступен (например, без HTTPS) — просто ничего не делаем
    }
  };

  const remove = () => {
    closePopup();
    if (window.confirm("Удалить сообщение? Это действие нельзя отменить.")) {
      onDelete(message.id);
    }
  };

  return (
    // tabIndex: на телефоне касание сообщения фокусирует его и показывает панель действий
    <article
      className={`${styles.message} ${openPopup ? styles.messageActive : ""}`}
      tabIndex={0}
      aria-label={`Сообщение: ${author.displayName}`}
    >
      <AnonymousAvatar size="md" />

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.author}>{author.displayName}</span>
          <time className={styles.time} dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
          {message.editedAt && <span className={styles.time}>(изменено)</span>}
        </div>

        {message.replyToId && (
          <div className={styles.reply}>
            {replyTo ? (
              <>
                <span className={styles.replyAuthor}>{replyTo.author.displayName}:</span>{" "}
                {replyTo.content}
              </>
            ) : (
              "Исходное сообщение удалено"
            )}
          </div>
        )}

        <p className={styles.text}>
          <MessageText content={message.content} />
        </p>

        {message.reactions.length > 0 && (
          <div className={styles.reactions}>
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                className={`${styles.reaction} ${reaction.reactedByMe ? styles.reactionMine : ""}`}
                onClick={() => onReact(message.id, reaction.emoji)}
                aria-pressed={reaction.reactedByMe}
                aria-label={`${reaction.emoji} ${reaction.count}`}
              >
                <span>{reaction.emoji}</span>
                <span className={styles.reactionCount}>{reaction.count}</span>
              </button>
            ))}
            <button
              type="button"
              className={styles.addReaction}
              onClick={() => setOpenPopup(openPopup === "picker" ? null : "picker")}
              aria-label="Добавить реакцию"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Панель действий: видна при наведении, фокусе или открытом меню */}
      <div className={styles.actions} ref={popupRef}>
        {HOVER_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={styles.actionButton}
            onClick={() => react(emoji)}
            aria-label={`Реакция ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => onReply(message)}
          aria-label="Ответить"
          title="Ответить"
        >
          <Reply size={14} />
        </button>
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => setOpenPopup(openPopup === "menu" ? null : "menu")}
          aria-label="Ещё действия"
          aria-haspopup="menu"
          aria-expanded={openPopup === "menu"}
        >
          <Ellipsis size={14} />
        </button>

        {openPopup === "picker" && <EmojiPicker onSelect={react} className={styles.popup} />}

        {openPopup === "menu" && (
          <div className={`${styles.menu} ${styles.popup}`} role="menu">
            <button type="button" role="menuitem" className={styles.menuItem} onClick={copyText}>
              <Copy size={14} /> Копировать текст
            </button>
            {isMine && (
              <button
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={remove}
              >
                <Trash size={14} /> Удалить
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
