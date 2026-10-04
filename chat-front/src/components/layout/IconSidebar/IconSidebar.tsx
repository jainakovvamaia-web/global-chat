"use client";

import { usePathname } from "next/navigation";
import LogoMark from "@/components/ui/LogoMark/LogoMark";
import { canModerate } from "@/hooks/api/useCommunities";
import type { MemberRole } from "@/types";
import NavButton from "../NavButton/NavButton";
import { getActiveSection, NAV_ITEMS, type SectionKey } from "../navItems";
import styles from "./IconSidebar.module.css";

const MAIN_SECTIONS: SectionKey[] = ["chat", "nearby"];
const BOTTOM_SECTIONS: SectionKey[] = ["settings", "profile"];

interface IconSidebarProps {
  communityId: string;
  myRole: MemberRole | undefined;
}

// Узкая тёмная панель слева (только на десктопе)
export default function IconSidebar({ communityId, myRole }: IconSidebarProps) {
  const activeSection = getActiveSection(usePathname());

  const renderButton = (key: SectionKey) => (
    <NavButton
      key={key}
      item={NAV_ITEMS[key]}
      communityId={communityId}
      isActive={activeSection === key}
      className={styles.navButton}
      activeClassName={styles.active}
    />
  );

  return (
    <nav className={styles.sidebar} aria-label="Разделы сообщества">
      <LogoMark size="lg" />
      <div className={styles.divider} />

      <div className={styles.main}>{MAIN_SECTIONS.map(renderButton)}</div>

      {/* Панель администратора видна только администраторам и модераторам */}
      {canModerate(myRole) && renderButton("admin")}
      <div className={styles.divider} />
      {BOTTOM_SECTIONS.map(renderButton)}
    </nav>
  );
}
