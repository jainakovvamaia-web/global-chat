import styles from "./EmojiChoice.module.css";

interface EmojiChoiceProps {
  label: string;
  options: string[];
  value: string;
  onChange: (emoji: string) => void;
}

// Выбор иконки из набора эмодзи (для канала, события, сообщества)
export default function EmojiChoice({ label, options, value, onChange }: EmojiChoiceProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.grid}>
        {options.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={`${styles.option} ${emoji === value ? styles.active : ""}`}
            onClick={() => onChange(emoji)}
            aria-pressed={emoji === value}
            aria-label={`${label}: ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
