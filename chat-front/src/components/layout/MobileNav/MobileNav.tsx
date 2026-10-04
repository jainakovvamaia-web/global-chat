"use client";

import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/api/useNotifications";
import NavButton from "../NavButton/NavButton";
import { getActiveSection, NAV_ITEMS, type SectionKey } from "../navItems";
import styles from "./MobileNav.module.css";

const MOBILE_SECTIONS: SectionKey[] = ["chat", "nearby", "events", "notifications", "profile"];

// Нижняя навигация на телефонах и планшетах (< 1024px).
// Остальные разделы (участники, AI, настройки, админка) открываются из профиля.
export default function MobileNav({ communityId }: { communityId: string }) {
  const activeSection = getActiveSection(usePathname());
  const { unreadCount: unreadNotifications } = useNotifications();

  return (
    <nav className={styles.nav} aria-label="Разделы сообщества">
      {MOBILE_SECTIONS.map((key) => (
        <NavButton
          key={key}
          item={NAV_ITEMS[key]}
          communityId={communityId}
          isActive={activeSection === key}
          className={styles.item}
          activeClassName={styles.active}
          badge={key === "notifications" ? unreadNotifications : 0}
          showLabel
        />
      ))}
    </nav>
  );
}
