import Link from "next/link";
import type { ReactNode } from "react";
import { Menu, Search, Users, X } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";
import type { ChatRoomInfo } from "../chatRoom";
import styles from "./ChatHeader.module.css";

interface ChatHeaderProps {
  room: ChatRoomInfo;
  searchQuery: string | null;
  resultsCount: number | null;
  onSearchChange: (query: string | null) => void;
  extraActions?: ReactNode; // например, «Пригласить участников» для создателя группы
}

export default function ChatHeader({
  room,
  searchQuery,
  resultsCount,
  onSearchChange,
  extraActions,
}: ChatHeaderProps) {
  const openChannelDrawer = useUiStore((state) => state.openChannelDrawer);
  const isSearchOpen = searchQuery !== null;

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        {/* Только на телефоне: открывает список каналов */}
        <button
          type="button"
          className={`${styles.iconButton} ${styles.menuButton}`}
          onClick={openChannelDrawer}
          aria-label="Открыть список каналов"
        >
          <Menu size={20} />
        </button>

        <div className={styles.title}>
          <span className={styles.emoji} aria-hidden="true">
            {room.emoji}
          </span>
          <div className={styles.titleText}>
            <h1 className={styles.name}>{room.title}</h1>
            <p className={styles.description}>{room.description}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.iconButton} ${isSearchOpen ? styles.iconButtonActive : ""}`}
            onClick={() => onSearchChange(isSearchOpen ? null : "")}
            aria-label={isSearchOpen ? "Закрыть поиск" : "Поиск по каналу"}
            aria-pressed={isSearchOpen}
          >
            <Search size={16} />
          </button>
          {room.membersHref && (
            <Link href={room.membersHref} className={styles.iconButton} title="Участники" aria-label="Участники">
              <Users size={16} />
            </Link>
          )}
          {extraActions}
        </div>
      </div>

      {isSearchOpen && (
        <div className={styles.search}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.searchInput}
            placeholder={`Поиск в «${room.title}»...`}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && onSearchChange(null)}
            aria-label="Поиск сообщений"
            autoFocus
          />
          {resultsCount !== null && (
            <span className={styles.searchCount}>Найдено: {resultsCount}</span>
          )}
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => onSearchChange(null)}
            aria-label="Закрыть поиск"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </header>
  );
}
