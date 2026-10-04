import Button from "@/components/ui/Button/Button";
import { getChatEmoji } from "@/lib/placeChats";
import type { PlaceChat } from "@/types";
import styles from "../CommunityCard/CommunityCard.module.css";

// Карточка чата по месту на странице «Мои чаты» — в том же стиле, что карточка сообщества
export default function ChatCard({ chat, href }: { chat: PlaceChat; href: string | null }) {
  return (
    <article className={styles.card}>
      <div className={`${styles.cover} ${styles.coverSmall}`}>
        <span aria-hidden="true">{getChatEmoji(chat)}</span>
      </div>
      <div className={styles.body}>
        <h3 className={`${styles.name} ${styles.nameSpaced}`}>{chat.name}</h3>
        {chat.description && <p className={styles.description}>{chat.description}</p>}
        {href ? (
          <Button href={href} variant="soft" size="sm" fullWidth>
            Открыть чат
          </Button>
        ) : (
          <Button variant="soft" size="sm" fullWidth disabled title="Сначала вступите в сообщество своего города">
            Открыть чат
          </Button>
        )}
      </div>
    </article>
  );
}
