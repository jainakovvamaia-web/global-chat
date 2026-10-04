import { Send } from "lucide-react";
import { AnonymousAvatar } from "@/components/ui/Avatar/Avatar";
import { ANONYMOUS_NAME } from "@/lib/identity";
import styles from "./ChatMockup.module.css";

const PREVIEW_MESSAGES = [
  { id: 1, text: "Кто сегодня идёт в библиотеку? 📚", time: "09:42", reaction: "👍 3" },
  { id: 2, text: "Я буду после 15:00!", time: "09:45", reaction: "🔥 2" },
  { id: 3, text: "Кто придёт на футбол в пятницу? ⚽", time: "09:51", reaction: "" },
];

// Декоративная картинка чата на лендинге (не интерактивная — это иллюстрация)
export default function ChatMockup() {
  return (
    <div className={styles.mockup} aria-hidden="true">
      <div className={styles.header}>
        <div className={styles.headerAvatar}>61</div>
        <div>
          <div className={styles.headerTitle}>Школа №61</div>
          <div className={styles.headerSubtitle}>#general · 86 онлайн</div>
        </div>
      </div>
      <div className={styles.body}>
        {PREVIEW_MESSAGES.map((message) => (
          <div key={message.id} className={styles.message}>
            {/* Как и в настоящем чате, авторы анонимны */}
            <AnonymousAvatar size="sm" />
            <div className={styles.messageBody}>
              <div className={styles.meta}>
                <span className={styles.author}>{ANONYMOUS_NAME}</span>
                <span className={styles.time}>{message.time}</span>
              </div>
              <div className={styles.bubble}>{message.text}</div>
              {message.reaction && <div className={styles.reaction}>{message.reaction}</div>}
            </div>
          </div>
        ))}
        <div className={styles.input}>
          <span>Написать сообщение...</span>
          <span className={styles.send}>
            <Send size={12} />
          </span>
        </div>
      </div>
      <div className={styles.footer}>
        <div className={styles.tabs}>
          {["🏠", "📢", "😂", "📚"].map((emoji, index) => (
            <span key={emoji} className={`${styles.tab} ${index === 0 ? styles.tabActive : ""}`}>
              {emoji}
            </span>
          ))}
        </div>
        <div className={styles.online}>
          <span className={styles.onlineDot} />
          86 онлайн
        </div>
      </div>
    </div>
  );
}
