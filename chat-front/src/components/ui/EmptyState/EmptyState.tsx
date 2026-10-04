import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  emoji: string;
  title: string;
  text?: string;
  action?: ReactNode;
}

// «Ничего не найдено», «Нет уведомлений» и другие пустые состояния
export default function EmptyState({ emoji, title, text, action }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <div className={styles.emoji} aria-hidden="true">
        {emoji}
      </div>
      <p className={styles.title}>{title}</p>
      {text && <p className={styles.text}>{text}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
