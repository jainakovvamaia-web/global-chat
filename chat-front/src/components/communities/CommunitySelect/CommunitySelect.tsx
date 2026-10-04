"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import PrivateAccessModal from "@/components/community/PrivateAccessModal/PrivateAccessModal";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import LogoMark from "@/components/ui/LogoMark/LogoMark";
import SearchInput from "@/components/ui/SearchInput/SearchInput";
import { useAvailableChats } from "@/hooks/useAvailableChats";
import { groupAvailableChats } from "@/lib/placeChats";
import { useCommunities, useJoinCommunity } from "@/hooks/api/useCommunities";
import { getErrorMessage } from "@/lib/api";
import type { Community } from "@/types";
import ChatCard from "../ChatCard/ChatCard";
import CommunityCard from "../CommunityCard/CommunityCard";
import CreateCommunityModal from "../CreateCommunityModal/CreateCommunityModal";
import styles from "./CommunitySelect.module.css";

// «undefined» — окно закрыто, null — вход по коду без выбранного сообщества
type PrivateModalState = Community | null | undefined;

// «Мои чаты»: чаты по городу, району и учебному заведению из профиля + сообщества своего города.
// Список доступных чатов определяет сервер (GET /api/chats) по профилю пользователя.
export default function CommunitySelect() {
  const router = useRouter();
  const communitiesQuery = useCommunities();
  const communities = communitiesQuery.data ?? [];
  const joinCommunity = useJoinCommunity();
  const { profile, chats, chatsQuery } = useAvailableChats();
  const cityId = profile?.location.cityId ?? "";
  // Создавать сообщества может только admin платформы — кнопка лишь интерфейс, проверяет сервер
  const isAdmin = profile?.role === "admin";

  const [query, setQuery] = useState("");
  const [privateModal, setPrivateModal] = useState<PrivateModalState>(undefined);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(normalizedQuery);

  // Чаты открываются внутри сообщества своего города (там каналы города и колонка «Мои чаты»)
  const homeCommunity = communities.find((item) => item.joined && item.cityId === cityId);
  const chatHref = (chatId: string) =>
    homeCommunity ? `/${homeCommunity.id}/chat/place/${encodeURIComponent(chatId)}` : null;

  const sections = groupAvailableChats(
    chats.filter((chat) => matches(chat.name)),
    profile?.locationNames,
  );
  const cityCommunities = communities.filter(
    (item) => (item.cityId === cityId || item.joined) && (matches(item.name) || matches(item.description)),
  );

  const names = profile?.locationNames;
  const subtitle = [names?.city, names?.district, names?.institution].filter(Boolean).join(" · ");
  const loadError = communitiesQuery.error ?? chatsQuery.error;
  const isLoading = communitiesQuery.isLoading || chatsQuery.isLoading;

  const handleJoin = (community: Community) => {
    if (community.joined) {
      router.push(`/${community.id}/chat/general`);
    } else if (community.isPrivate) {
      setPrivateModal(community);
    } else {
      joinCommunity.mutate(community.id, { onSuccess: () => router.push(`/${community.id}/chat/general`) });
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Link href="/" className={styles.back} aria-label="На главную">
              <ArrowLeft size={20} />
            </Link>
            <LogoMark size="sm" />
            <span className={styles.brandName}>Global Chat</span>
          </div>
          <div className={styles.headerActions}>
            <Button variant="ghost" size="sm" onClick={() => setPrivateModal(null)}>
              Войти по коду
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                + Создать
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Мои чаты</h1>
          <p className={styles.lead}>
            {subtitle || "Укажите город и район в профиле, чтобы увидеть чаты своего района и учебного заведения"}
          </p>
        </div>

        <div className={styles.search}>
          <SearchInput size="lg" value={query} onChange={setQuery} placeholder="Найти чат или сообщество..." />
        </div>

        {sections.map((section) => (
          <section key={section.key} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span aria-hidden="true">{section.emoji}</span> {section.title}
            </h2>
            {section.blocks.map((block) => (
              <div key={block.subtitle ?? "main"} className={styles.block}>
                {block.subtitle && <h3 className={styles.blockTitle}>{block.subtitle}</h3>}
                <div className={styles.grid}>
                  {block.chats.map((chat) => (
                    <ChatCard key={chat.id} chat={chat} href={chatHref(chat.id)} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}

        {cityCommunities.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <span aria-hidden="true">🏘️</span> Сообщества
            </h2>
            <div className={styles.grid}>
              {cityCommunities.map((community) => (
                <CommunityCard key={community.id} community={community} onJoin={() => handleJoin(community)} />
              ))}
            </div>
          </section>
        )}

        {joinCommunity.isError && <p className={styles.lead} role="alert">{getErrorMessage(joinCommunity.error)}</p>}

        {loadError && (
          <EmptyState emoji="⚠️" title="Не удалось загрузить чаты" text={getErrorMessage(loadError)} />
        )}

        {!isLoading && !loadError && sections.length === 0 && cityCommunities.length === 0 && (
          <EmptyState
            emoji="🔍"
            title="Ничего не найдено"
            text={isAdmin ? "Попробуй другой запрос или создай своё сообщество" : "Попробуй другой запрос"}
            action={isAdmin ? <Button onClick={() => setIsCreateOpen(true)}>+ Создать сообщество</Button> : undefined}
          />
        )}
      </main>

      {privateModal !== undefined && (
        <PrivateAccessModal community={privateModal} onClose={() => setPrivateModal(undefined)} />
      )}
      {isCreateOpen && <CreateCommunityModal onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}
