import styles from "./FilterChips.module.css";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface FilterChipsProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // muted — серый фон, ghost — без фона, outlined — белый с рамкой (как в макете в разных разделах)
  variant?: "muted" | "ghost" | "outlined";
  size?: "sm" | "md";
  label: string; // для экранных дикторов
}

// Горизонтальный ряд фильтров-«чипсов»: выбран всегда один вариант
export default function FilterChips<T extends string>({
  options,
  value,
  onChange,
  variant = "muted",
  size = "sm",
  label,
}: FilterChipsProps<T>) {
  return (
    <div className={styles.row} role="group" aria-label={label}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.chip} ${styles[variant]} ${styles[size]} ${isActive ? styles.active : ""}`}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
