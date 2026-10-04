"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import FilterChips, { type ChipOption } from "@/components/ui/FilterChips/FilterChips";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/api/useNotifications";
import { getErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { AppNotification, NotificationType } from "@/types";
import styles from "./NotificationsView.module.css";

type Filter = NotificationType | "all";

const FILTERS: ChipOption<Filter>[] = [
  { value: "all", label: "Все" },
  { value: "mention", label: "Упоминания" },
  { value: "reply", label: "Ответы" },
  { value: "event", label: "События" },
  { value: "announcement", label: "Объявления" },
  { value: "invite", label: "Приглашения" },
];

const ICONS: Record<NotificationType, string> = {
  mention: "💬",
  reply: "↩️",
  event: "📅",
  announcement: "📢",
  invite: "✉️",
  system: "ℹ️",
};

// Центр уведомлений: фильтры, отметка прочитанного и переход к источнику.
// Данные — с сервера; новые уведомления приходят сигналом Supabase Realtime (см. useNotifications).
export default function NotificationsView() {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "all" ? notifications : notifications.filter((item) => item.type === filter);

  const open = (notification: AppNotification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    if (notification.href) router.push(notification.href);
  };

  return (
    <section className={styles.page}>
      <PageHeader
        title={
          <>
            Уведомления
            {unreadCount > 0 && <span className={styles.counter}>{unreadCount}</span>}
          </>
        }
        actions={
          unreadCount > 0 && (
            <button type="button" className={styles.markAll} onClick={() => markAllRead.mutate()}>
              Отметить все прочитанными
            </button>
          )
        }
      />

      <div className={styles.filters}>
        <FilterChips label="Тип уведомлений" options={FILTERS} value={filter} onChange={setFilter} variant="ghost" />
      </div>

      <div className={styles.list}>
        {isLoading ? null : error ? (
          <EmptyState emoji="⚠️" title="Не удалось загрузить уведомления" text={getErrorMessage(error)} />
        ) : filtered.length === 0 ? (
          <EmptyState emoji="🔔" title="Нет уведомлений" text="Новые уведомления появятся здесь" />
        ) : (
          <ul>
            {filtered.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className={`${styles.item} ${notification.isRead ? "" : styles.unread}`}
                  onClick={() => open(notification)}
                >
                  <span className={styles.icon} aria-hidden="true">
                    {ICONS[notification.type]}
                  </span>
                  <span className={styles.content}>
                    <span className={styles.top}>
                      <span className={styles.title}>{notification.title}</span>
                      <span className={styles.time}>{formatRelative(notification.createdAt)}</span>
                    </span>
                    {/* Тексты уведомлений безличные: имена авторов в них не попадают */}
                    <span className={styles.text}>{notification.text}</span>
                  </span>
                  {!notification.isRead && <span className={styles.dot} aria-label="Не прочитано" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
