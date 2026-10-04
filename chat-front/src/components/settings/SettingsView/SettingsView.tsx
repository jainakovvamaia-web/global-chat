"use client";

import { useState } from "react";
import AccountSettings from "./AccountSettings";
import AppearanceSettings from "./AppearanceSettings";
import NotificationSettings from "./NotificationSettings";
import PrivacySettings from "./PrivacySettings";
import SecuritySettings from "./SecuritySettings";
import styles from "./SettingsView.module.css";

const SECTIONS = [
  { key: "account", label: "Аккаунт", emoji: "👤" },
  { key: "notifications", label: "Уведомления", emoji: "🔔" },
  { key: "privacy", label: "Приватность", emoji: "🔒" },
  { key: "appearance", label: "Внешний вид", emoji: "🎨" },
  { key: "security", label: "Безопасность", emoji: "🛡️" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

// Раздел «Настройки»: меню слева (на телефоне — сверху) и выбранная группа настроек
export default function SettingsView() {
  const [active, setActive] = useState<SectionKey>("account");

  return (
    <section className={styles.page} aria-label="Настройки">
      <nav className={styles.nav} aria-label="Группы настроек">
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            className={`${styles.navItem} ${active === section.key ? styles.navItemActive : ""}`}
            onClick={() => setActive(section.key)}
            aria-current={active === section.key ? "page" : undefined}
          >
            <span aria-hidden="true">{section.emoji}</span>
            {section.label}
          </button>
        ))}
      </nav>

      <div className={styles.content}>
        {active === "account" && <AccountSettings />}
        {active === "notifications" && <NotificationSettings />}
        {active === "privacy" && <PrivacySettings />}
        {active === "appearance" && <AppearanceSettings />}
        {active === "security" && <SecuritySettings />}
      </div>
    </section>
  );
}
