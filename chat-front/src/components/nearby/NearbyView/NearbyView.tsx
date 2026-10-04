"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import SearchInput from "@/components/ui/SearchInput/SearchInput";
import { useLocalChats } from "@/hooks/api/useChats";
import { canManageCommunity } from "@/hooks/api/useCommunities";
import { useProfile } from "@/hooks/api/useProfile";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { getErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import CreateLocalChatModal from "../CreateLocalChatModal/CreateLocalChatModal";
import styles from "./NearbyView.module.css";

// Чат считается «активным», если последнее сообщение было не больше часа назад
const ACTIVE_WITHIN_MS = 60 * 60 * 1000;

// Раздел «Рядом»: локальные чаты, привязанные к местам сообщества (ТЗ, п. 5.5).
// Геолокация пользователя не используется — чаты привязаны к местам, а не к людям.
export default function NearbyView() {
  const { communityId, community, myRole } = useCurrentCommunity();
  const { data: profile } = useProfile();
  // Создавать чаты «Рядом» могут admin платформы и администраторы сообщества (сервер проверяет то же)
  const canCreate = profile?.role === "admin" || canManageCommunity(myRole);
  const chatsQuery = useLocalChats(communityId, community?.joined === true);
  const [query, setQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const chats = (chatsQuery.data ?? []).filter(
    (chat) =>
      chat.name.toLowerCase().includes(normalizedQuery) ||
      (chat.description ?? "").toLowerCase().includes(normalizedQuery),
  );

  return (
    <section className={styles.page}>
      <PageHeader
        title="Рядом"
        subtitle="Локальные чаты вашего сообщества"
        actions={
          canCreate && (
            <Button variant="soft" size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus size={14} /> Создать чат
            </Button>
          )
        }
      />

      <div className={styles.body}>
        <div className={styles.search}>
          <SearchInput value={query} onChange={setQuery} placeholder="Найти чат по месту..." />
        </div>

        {chatsQuery.isLoading ? null : chatsQuery.error ? (
          <EmptyState emoji="⚠️" title="Не удалось загрузить чаты" text={getErrorMessage(chatsQuery.error)} />
        ) : chats.length === 0 ? (
          <EmptyState
            emoji="📍"
            title={normalizedQuery ? "Ничего не найдено" : "Локальных чатов пока нет"}
            text={
              normalizedQuery
                ? "Попробуй другой запрос"
                : canCreate
                  ? "Создай первый чат для своего двора, подъезда или корпуса"
                  : "Чаты двора, подъезда или корпуса создают администраторы сообщества"
            }
          />
        ) : (
          <ul className={styles.list}>
            {chats.map((chat) => {
              const lastMessage = chat.lastMessage;
              const isActive =
                lastMessage && Date.now() - new Date(lastMessage.createdAt).getTime() < ACTIVE_WITHIN_MS;

              return (
                <li key={chat.id}>
                  <Link href={`/${communityId}/nearby/${chat.id}`} className={styles.card}>
                    <span className={styles.emoji} aria-hidden="true">
                      {chat.emoji ?? "📍"}
                    </span>
                    <div className={styles.cardBody}>
                      <div className={styles.cardTop}>
                        <h3 className={styles.name}>{chat.name}</h3>
                        <div className={styles.time}>
                          {isActive && <span className={styles.activeDot} title="Активное обсуждение" />}
                          {lastMessage && formatRelative(lastMessage.createdAt)}
                        </div>
                      </div>
                      <div className={styles.meta}>
                        <span>{chat.membersCount} уч. · </span>
                        <span className={styles.online}>{chat.onlineCount} онлайн</span>
                        {chat.joined && <span className={styles.joined}>· вы участник</span>}
                      </div>
                      <p className={styles.lastMessage}>{lastMessage?.content ?? chat.description}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isCreateOpen && <CreateLocalChatModal communityId={communityId} onClose={() => setIsCreateOpen(false)} />}
    </section>
  );
}
