import styles from "./EmojiPicker.module.css";

// Небольшой набор эмодзи для реакций и поля ввода
export const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "🙏", "😮", "😢", "🎉", "👏", "😊", "👀", "✅"];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

export default function EmojiPicker({ onSelect, className = "" }: EmojiPickerProps) {
  return (
    <div className={`${styles.picker} ${className}`} role="menu" aria-label="Выбор эмодзи">
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="menuitem"
          className={styles.emoji}
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
