"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Pencil } from "lucide-react";
import { NAV_ITEMS, sectionHref, type SectionKey } from "@/components/layout/navItems";
import Avatar from "@/components/ui/Avatar/Avatar";
import Button from "@/components/ui/Button/Button";
import PageHeader from "@/components/ui/PageHeader/PageHeader";
import RoleBadge from "@/components/ui/RoleBadge/RoleBadge";
import { canModerate } from "@/hooks/api/useCommunities";
import { useMyStats, useProfile, useUpdateProfile } from "@/hooks/api/useProfile";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { getErrorMessage } from "@/lib/api";
import { formatFullDate } from "@/lib/format";
import { getFullName } from "@/lib/identity";
import { ROLE_LABELS } from "@/lib/members";
import PersonalDataCard from "../PersonalDataCard/PersonalDataCard";
import styles from "./ProfileView.module.css";

export default function ProfileView() {
  const { communityId, community, myRole } = useCurrentCommunity();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { data: myStats } = useMyStats();

  const [isEditing, setIsEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");

  // Профиль уже загружен (RequireAuth не пускает на страницу без него)
  if (!profile) return null;

  const fullName = getFullName(profile);

  const toggleEditing = () => {
    if (!isEditing) {
      setBioDraft(profile.bio);
      updateProfile.reset();
      setIsEditing(true);
      return;
    }
    const bio = bioDraft.trim();
    if (bio === profile.bio) {
      setIsEditing(false);
      return;
    }
    updateProfile.mutate({ bio }, { onSuccess: () => setIsEditing(false) });
  };

  // Считает сервер: свои сообщения, события, в которых участвую, и сообщества
  const stats = [
    { label: "Сообщений", value: myStats?.messages ?? "—" },
    { label: "Событий", value: myStats?.events ?? "—" },
    { label: "Сообществ", value: myStats?.communities ?? "—" },
  ];

  // На телефоне этих разделов нет в нижней навигации — даём ссылки на них из профиля
  const mobileLinks: SectionKey[] = ["members", "ai", "settings", ...(canModerate(myRole) ? (["admin"] as const) : [])];

  return (
    <section className={styles.page}>
      <PageHeader
        title="Мой профиль"
        actions={
          <Button variant="soft" size="sm" onClick={toggleEditing} disabled={updateProfile.isPending}>
            {isEditing ? "Сохранить" : "Редактировать"}
          </Button>
        }
      />

      <div className={styles.body}>
        <div className={styles.hero}>
          <div className={styles.avatar}>
            <Avatar name={fullName} size="xl" isOnline />
            {isEditing && (
              // TODO(backend): загрузка аватара в Supabase Storage
              <button
                type="button"
                className={styles.avatarEdit}
                disabled
                title="Загрузка фото появится после подключения сервера"
                aria-label="Изменить фото (скоро)"
              >
                <Pencil size={12} />
              </button>
            )}
          </div>
          <div>
            <h2 className={styles.name}>{fullName || profile.email}</h2>
            {profile.username && <p className={styles.username}>@{profile.username}</p>}
            <div className={styles.badges}>
              {myRole && <RoleBadge role={myRole} size="md" />}
              <span className={styles.online}>
                <span className={styles.onlineDot} />
                Онлайн
              </span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>О себе</h3>
          {isEditing ? (
            <textarea
              className={styles.bioInput}
              rows={3}
              value={bioDraft}
              onChange={(event) => setBioDraft(event.target.value)}
              aria-label="О себе"
              maxLength={500}
              autoFocus
            />
          ) : (
            <p className={styles.bio}>{profile.bio || "Расскажи о себе — нажми «Редактировать»"}</p>
          )}
          {updateProfile.isError && (
            <p className={styles.bio} role="alert">
              ⚠️ {getErrorMessage(updateProfile.error)}
            </p>
          )}
        </div>

        <PersonalDataCard />

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Информация</h3>
          <dl className={styles.info}>
            <div className={styles.infoRow}>
              <dt>Сообщество</dt>
              <dd>{community?.name}</dd>
            </div>
            <div className={styles.infoRow}>
              <dt>Роль в сообществе</dt>
              <dd>{myRole ? ROLE_LABELS[myRole] : "—"}</dd>
            </div>
            {/* Роль на всей платформе (не в сообществе): admin может создавать группы и сообщества */}
            <div className={styles.infoRow}>
              <dt>Роль на платформе</dt>
              <dd>{profile.role === "admin" ? "Администратор" : "Пользователь"}</dd>
            </div>
            <div className={styles.infoRow}>
              <dt>Дата регистрации</dt>
              <dd>{formatFullDate(profile.joinedAt)}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.stats}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        <nav className={styles.mobileLinks} aria-label="Другие разделы">
          {mobileLinks.map((key) => {
            const item = NAV_ITEMS[key];
            const Icon = item.icon;
            return (
              <Link key={key} href={sectionHref(communityId, key)} className={styles.mobileLink}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
