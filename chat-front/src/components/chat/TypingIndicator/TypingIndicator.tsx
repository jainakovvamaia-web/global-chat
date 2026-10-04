import styles from "./TypingIndicator.module.css";

// «Анонимно печатает…» — кто именно, не сообщается: сервер присылает только количество
export default function TypingIndicator({ count }: { count: number }) {
  return (
    <p className={styles.typing} aria-live="polite">
      {count === 1 ? "Анонимно печатает…" : count > 1 ? "Несколько человек печатают…" : " "}
    </p>
  );
}
