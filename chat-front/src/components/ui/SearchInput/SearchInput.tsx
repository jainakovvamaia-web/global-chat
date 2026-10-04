import { Search } from "lucide-react";
import styles from "./SearchInput.module.css";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  size?: "md" | "lg";
}

// Поле поиска с иконкой лупы (участники, локальные чаты, сообщества)
export default function SearchInput({ value, onChange, placeholder, size = "md" }: SearchInputProps) {
  return (
    <div className={styles.wrapper}>
      <Search size={16} className={`${styles.icon} ${styles[`icon-${size}`]}`} aria-hidden="true" />
      <input
        type="search"
        className={`${styles.input} ${styles[size]}`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
    </div>
  );
}
