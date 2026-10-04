import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useDismiss } from "@/hooks/useDismiss";
import { formatCount } from "@/lib/format";
import { useCommunities } from "@/hooks/api/useCommunities";
import type { Community } from "@/types";
import styles from "./ChannelSidebar.module.css";

// Шапка колонки каналов: текущее сообщество + меню для переключения между своими сообществами
export default function CommunitySwitcher({ community }: { community: Community }) {
  const { data: communities = [] } = useCommunities();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useDismiss(containerRef, isOpen, close);

  const joinedCommunities = communities.filter((item) => item.joined);

  return (
    <div className={styles.switcher} ref={containerRef}>
      <button
        type="button"
        className={styles.switcherButton}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className={styles.communityEmoji} aria-hidden="true">
          {community.emoji}
        </span>
        <span className={styles.communityText}>
          <span className={styles.communityName}>{community.name}</span>
          <span className={styles.communityOnline}>
            <span className={styles.onlineDot} />
            {formatCount(community.onlineCount)} онлайн
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className={styles.switcherMenu} role="menu">
          <div className={styles.switcherMenuTitle}>Мои сообщества</div>
          {joinedCommunities.map((item) => (
            <Link
              key={item.id}
              href={`/${item.id}/chat/general`}
              role="menuitem"
              className={styles.switcherItem}
              onClick={close}
            >
              <span aria-hidden="true">{item.emoji}</span>
              <span className={styles.switcherItemName}>{item.name}</span>
              {item.id === community.id && <Check size={14} className={styles.switcherCheck} />}
            </Link>
          ))}
          <div className={styles.switcherDivider} />
          <Link href="/communities" role="menuitem" className={styles.switcherItem} onClick={close}>
            <Search size={14} aria-hidden="true" />
            <span className={styles.switcherItemName}>Все мои чаты и сообщества</span>
          </Link>
        </div>
      )}
    </div>
  );
}
