"use client";

import { useState } from "react";
import { AnonymousAvatar } from "@/components/ui/Avatar/Avatar";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import FilterChips, { type ChipOption } from "@/components/ui/FilterChips/FilterChips";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import RoleBadge from "@/components/ui/RoleBadge/RoleBadge";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { formatCount } from "@/lib/format";
import type { MemberRole } from "@/types";
import styles from "./MembersView.module.css";

type RoleFilter = MemberRole | "all";

const ROLE_FILTERS: ChipOption<RoleFilter>[] = [
  { value: "all", label: "Все" },
  { value: "owner", label: "Владелец" },
  { value: "admin", label: "Админ" },
  { value: "moderator", label: "Мод." },
  { value: "member", label: "Участник" },
];

// Раздел «Участники»: все показаны анонимно, поэтому доступен только фильтр по роли
// (поиск по имени не имеет смысла и мог бы раскрыть людей).
export default function MembersView() {
  const { community, members } = useCurrentCommunity();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  if (!community) return null;

  const filtered = members.filter((member) => roleFilter === "all" || member.role === roleFilter);

  return (
    <section className={styles.page}>
      <PageHeader
        title="Участники"
        subtitle={`${formatCount(community.membersCount)} участников · ${formatCount(community.onlineCount)} онлайн`}
      />

      <div className={styles.filters}>
        <FilterChips label="Фильтр по роли" options={ROLE_FILTERS} value={roleFilter} onChange={setRoleFilter} />
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <EmptyState emoji="👥" title="Участники не найдены" />
        ) : (
          <ul>
            {filtered.map((member) => (
              <li key={member.id} className={styles.row}>
                <AnonymousAvatar size="md" isOnline={member.isOnline} />
                <div className={styles.text}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>
                      {member.displayName}
                      {member.isSelf && <span className={styles.you}> (вы)</span>}
                    </span>
                    <RoleBadge role={member.role} />
                  </div>
                  <div className={styles.meta}>
                    {member.isOnline ? <span className={styles.online}>онлайн</span> : "не в сети"}
                  </div>
                </div>
                {!member.isSelf && (
                  // Личные сообщения по ТЗ — в следующей версии после MVP
                  <button
                    type="button"
                    className={styles.writeButton}
                    disabled
                    title="Личные сообщения появятся в следующей версии"
                  >
                    Написать
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
