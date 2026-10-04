"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { formatDayMonth, formatTime } from "@/lib/format";
import { useEvent, useToggleEventJoin } from "@/hooks/api/useEvents";
import { ANONYMOUS_NAME } from "@/lib/identity";
import { getJoinState } from "../eventJoinState";
import styles from "./EventDetails.module.css";

// Страница мероприятия: подробности, запись и ссылка, которой можно поделиться
export default function EventDetails({ eventId }: { eventId: string }) {
  const { communityId } = useCurrentCommunity();
  const eventQuery = useEvent(eventId);
  const event = eventQuery.data;
  const toggleJoin = useToggleEventJoin(communityId);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");

  if (!event || event.communityId !== communityId) {
    return (
      <div className={styles.notFound}>
        <EmptyState
          emoji="📅"
          title="Событие не найдено"
          action={<Button href={`/${communityId}/events`}>Все события</Button>}
        />
      </div>
    );
  }

  const joinState = getJoinState(event);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("copied");
    } catch {
      setShareStatus("failed");
    }
  };

  const infoRows = [
    { icon: "📍", label: "Место", value: event.location },
    { icon: "👤", label: "Организатор", value: event.isOrganizer ? `${ANONYMOUS_NAME} (вы)` : ANONYMOUS_NAME },
    {
      icon: "👥",
      label: "Участники",
      value: `${event.attendees}${event.maxAttendees !== null ? ` / ${event.maxAttendees}` : ""} человек`,
    },
  ];

  return (
    <section className={styles.page}>
      <PageHeader title="Детали события" backHref={`/${communityId}/events`} />

      <div className={styles.body}>
        <div className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroEmoji} aria-hidden="true">
              {event.emoji}
            </div>
            <h2 className={styles.title}>{event.title}</h2>
            <p className={styles.date}>
              {formatDayMonth(event.startsAt)} в {formatTime(event.startsAt)}
            </p>
          </div>

          <ul className={styles.info}>
            {infoRows.map((row) => (
              <li key={row.label} className={styles.infoRow}>
                <span className={styles.infoIcon} aria-hidden="true">
                  {row.icon}
                </span>
                <div>
                  <div className={styles.infoLabel}>{row.label}</div>
                  <div className={styles.infoValue}>{row.value}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Описание</h3>
            <p className={styles.description}>{event.description || "Описание не добавлено"}</p>
          </div>

          <div className={styles.actions}>
            <Button
              variant={event.joined ? "dangerOutline" : "primary"}
              size="lg"
              fullWidth
              onClick={() => toggleJoin.mutate(event)}
              disabled={joinState === "full"}
            >
              {joinState === "joined" ? "Отменить участие" : joinState === "full" ? "Мест нет" : "Присоединиться"}
            </Button>
            <Button variant="secondary" size="lg" onClick={share} aria-label="Скопировать ссылку на событие">
              <Share2 size={16} />
            </Button>
          </div>
          {shareStatus !== "idle" && (
            <p className={styles.shareStatus} role="status">
              {shareStatus === "copied" ? "Ссылка на событие скопирована" : "Не удалось скопировать ссылку"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
