"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { canManageCommunity, canModerate } from "@/hooks/api/useCommunities";
import AdminChannels from "./AdminChannels";
import AdminMembers from "./AdminMembers";
import AdminOverview from "./AdminOverview";
import styles from "./AdminView.module.css";

type Tab = "overview" | "members" | "channels" | "moderation";

// Панель администратора (ТЗ, п. 4 и 11): обзор, участники, каналы, модерация
export default function AdminView() {
  const { community, myRole } = useCurrentCommunity();
  const [tab, setTab] = useState<Tab>("overview");

  if (!community) return null;

  if (!canModerate(myRole)) {
    return (
      <div className={styles.denied}>
        <EmptyState emoji="🔒" title="Нет доступа" text="Панель доступна администраторам и модераторам сообщества" />
      </div>
    );
  }

  // Участниками и каналами управляют администраторы и владелец, модератор видит обзор и модерацию
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Обзор" },
    ...(canManageCommunity(myRole)
      ? [
          { key: "members" as const, label: "Участники" },
          { key: "channels" as const, label: "Каналы" },
        ]
      : []),
    { key: "moderation", label: "Модерация" },
  ];

  return (
    <section className={styles.page}>
      <PageHeader
        icon={
          <span className={styles.icon} aria-hidden="true">
            <ShieldCheck size={14} />
          </span>
        }
        title={
          <>
            Панель администратора
            <span className={styles.communityBadge}>{community.name}</span>
          </>
        }
      />

      <div className={styles.tabs} role="tablist">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`${styles.tab} ${tab === item.key ? styles.tabActive : ""}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.body} role="tabpanel">
        {tab === "overview" && <AdminOverview />}
        {tab === "members" && <AdminMembers />}
        {tab === "channels" && <AdminChannels />}
        {tab === "moderation" && (
          // Жалоб в текущей версии API нет — раздел готов к их подключению
          <EmptyState
            emoji="✅"
            title="Нарушений не обнаружено"
            text="Жалобы от пользователей и подозрительная активность появятся здесь"
          />
        )}
      </div>
    </section>
  );
}
