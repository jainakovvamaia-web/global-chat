import { SelectField } from "@/components/ui/TextField/TextField";
import { useSettings, useUpdateSettings } from "@/hooks/api/useProfile";
import { getErrorMessage } from "@/lib/api";
import { PRIVACY_OPTIONS } from "@/lib/settings";
import styles from "./SettingsView.module.css";

// Приватность: кто может написать и кто видит онлайн-статус (хранится на сервере)
export default function PrivacySettings() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  if (!settings) return null;

  return (
    <div className={styles.group}>
      <h2 className={styles.groupTitle}>Приватность</h2>
      <div className={styles.card}>
        <SelectField
          label="Кто может написать мне"
          options={PRIVACY_OPTIONS.whoCanMessage}
          value={settings.privacy.whoCanMessage}
          onChange={(event) => updateSettings.mutate({ privacy: { whoCanMessage: event.target.value } })}
        />
      </div>
      <div className={styles.card}>
        <SelectField
          label="Кто видит мой онлайн-статус"
          options={PRIVACY_OPTIONS.whoSeesOnline}
          value={settings.privacy.whoSeesOnline}
          onChange={(event) => updateSettings.mutate({ privacy: { whoSeesOnline: event.target.value } })}
        />
      </div>
      {updateSettings.isError && (
        <p className={styles.error} role="alert">
          {getErrorMessage(updateSettings.error)}
        </p>
      )}
    </div>
  );
}
