"use client";

import { useState } from "react";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { formatDayMonth, formatTime } from "@/lib/format";
import { useEvents, useToggleEventJoin } from "@/hooks/api/useEvents";
import CreateEventModal from "../CreateEventModal/CreateEventModal";
import { getJoinState } from "../eventJoinState";
import styles from "./EventsView.module.css";

// Раздел «События»: ближайшие мероприятия сообщества (ТЗ, п. 5.7)
export default function EventsView() {
  const { communityId } = useCurrentCommunity();
  const { data: allEvents = [] } = useEvents(communityId);
  const toggleJoin = useToggleEventJoin(communityId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const events = [...allEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <section className={styles.page}>
      <PageHeader
        title="События сообщества"
        subtitle="Ближайшие мероприятия"
        actions={
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            + Создать событие
          </Button>
        }
      />

      <div className={styles.body}>
        {events.length === 0 ? (
          <EmptyState emoji="📅" title="Событий пока нет" text="Создай первое мероприятие сообщества" />
        ) : (
          <ul className={styles.list}>
            {events.map((event) => {
              const joinState = getJoinState(event);
              return (
                <li key={event.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.emoji} aria-hidden="true">
                      {event.emoji}
                    </span>
                    <div>
                      <div className={styles.date}>{formatDayMonth(event.startsAt)}</div>
                      <div className={styles.time}>{formatTime(event.startsAt)}</div>
                    </div>
                    {event.joined && <span className={styles.joinedBadge}>✓ Участвую</span>}
                  </div>
                  <div className={styles.cardBody}>
                    <h3 className={styles.title}>{event.title}</h3>
                    <p className={styles.description}>{event.description}</p>
                    <div className={styles.footer}>
                      <div className={styles.meta}>
                        <span>📍 {event.location}</span>
                        <span>
                          👥 {event.attendees}
                          {event.maxAttendees !== null && `/${event.maxAttendees}`}
                        </span>
                      </div>
                      <div className={styles.actions}>
                        <Button variant="ghost" size="xs" href={`/${communityId}/events/${event.id}`}>
                          Подробнее
                        </Button>
                        <Button
                          variant={event.joined ? "neutral" : "primary"}
                          size="sm"
                          onClick={() => toggleJoin.mutate(event)}
                          disabled={joinState === "full"}
                        >
                          {joinState === "joined" ? "Отменить" : joinState === "full" ? "Мест нет" : "Участвовать"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isCreateOpen && <CreateEventModal communityId={communityId} onClose={() => setIsCreateOpen(false)} />}
    </section>
  );
}
