import Toggle from "@/components/ui/Toggle/Toggle";
import { useSettings, useUpdateSettings } from "@/hooks/api/useProfile";
import { getErrorMessage } from "@/lib/api";
import type { NotificationSettingKey, UserSettings } from "@/types";
import styles from "./SettingsView.module.css";

const LABELS: Record<NotificationSettingKey, [string, string]> = {
  messages: ["Новые сообщения", "Уведомления о входящих сообщениях"],
  mentions: ["Упоминания", "Когда кто-то упоминает вас"],
  replies: ["Ответы", "Ответы на ваши сообщения"],
  announcements: ["Объявления", "Важные объявления от администрации"],
  events: ["События", "Напоминания о предстоящих мероприятиях"],
};

// Какие уведомления получать (ТЗ, п. 5.8). Хранится на сервере: по этим настройкам
// сервер решает, создавать ли уведомление.
export default function NotificationSettings() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  if (!settings) return null;

  return (
    <div className={styles.group}>
      <h2 className={styles.groupTitle}>Уведомления</h2>
      {(Object.keys(LABELS) as NotificationSettingKey[]).map((key) => (
        <div key={key} className={styles.option}>
          <div>
            <div className={styles.optionTitle}>{LABELS[key][0]}</div>
            <div className={styles.optionText}>{LABELS[key][1]}</div>
          </div>
          <Toggle
            label={LABELS[key][0]}
            checked={settings.notifications[key]}
            onChange={(value) => updateSettings.mutate({ notifications: { [key]: value } as Partial<UserSettings["notifications"]> })}
          />
        </div>
      ))}
      {updateSettings.isError && (
        <p className={styles.error} role="alert">
          {getErrorMessage(updateSettings.error)}
        </p>
      )}
    </div>
  );
}
