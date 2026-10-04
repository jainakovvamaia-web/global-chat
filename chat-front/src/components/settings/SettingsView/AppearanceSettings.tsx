import { useSettings, useUpdateSettings } from "@/hooks/api/useProfile";
import type { Theme } from "@/types";
import styles from "./SettingsView.module.css";

const THEMES: { value: Theme; emoji: string; title: string; text: string; available: boolean }[] = [
  { value: "light", emoji: "☀️", title: "Светлая", text: "Всегда светлая тема", available: true },
  { value: "dark", emoji: "🌙", title: "Тёмная", text: "Всегда тёмная тема", available: false },
  { value: "system", emoji: "💻", title: "Системная", text: "Следовать настройкам системы", available: false },
];

// Внешний вид. В макете нарисована только светлая тема, поэтому тёмная пока недоступна.
export default function AppearanceSettings() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const theme = settings?.theme ?? "light";
  const setTheme = (value: Theme) => updateSettings.mutate({ theme: value });

  return (
    <div className={styles.group} role="radiogroup" aria-label="Тема оформления">
      <h2 className={styles.groupTitle}>Внешний вид</h2>
      {THEMES.map((item) => {
        const isActive = theme === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={!item.available}
            className={`${styles.themeOption} ${isActive ? styles.themeActive : ""} ${item.available ? "" : styles.themeDisabled}`}
            onClick={() => setTheme(item.value)}
          >
            <span className={styles.themeEmoji} aria-hidden="true">
              {item.emoji}
            </span>
            <span>
              <span className={`${styles.optionTitle} ${styles.block}`}>{item.title}</span>
              <span className={`${styles.optionText} ${styles.block}`}>
                {item.available ? item.text : `${item.text} — появится позже`}
              </span>
            </span>
            {isActive && <span className={styles.radioDot} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
