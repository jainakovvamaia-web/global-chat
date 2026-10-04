"use client";

import { useState, type ReactNode } from "react";
import PrivateAccessModal from "@/components/community/PrivateAccessModal/PrivateAccessModal";
import Button from "@/components/ui/Button/Button";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { formatCount } from "@/lib/format";
import { useJoinCommunity } from "@/hooks/api/useCommunities";
import { getErrorMessage } from "@/lib/api";
import IconSidebar from "../IconSidebar/IconSidebar";
import MobileNav from "../MobileNav/MobileNav";
import styles from "./CommunityShell.module.css";

// Оболочка приложения внутри сообщества:
// [панель иконок] [содержимое раздела на всю оставшуюся ширину] + нижняя навигация на телефоне
export default function CommunityShell({ children }: { children: ReactNode }) {
  const { communityId, community, communityQuery, myRole } = useCurrentCommunity();

  if (communityQuery.isLoading) return null;

  if (!community) {
    return (
      <div className={styles.centered}>
        <EmptyState
          emoji="🔍"
          title="Сообщество не найдено"
          text="Возможно, ссылка устарела или сообщество было удалено"
          action={<Button href="/communities">Мои чаты</Button>}
        />
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <IconSidebar communityId={communityId} myRole={myRole} />
      <main className={styles.content}>{community.joined ? children : <JoinGate />}</main>
      <MobileNav communityId={communityId} />
    </div>
  );
}

// Экран для тех, кто открыл сообщество по ссылке, но ещё не вступил в него
function JoinGate() {
  const { community } = useCurrentCommunity();
  const joinCommunity = useJoinCommunity();
  const [isPrivateModalOpen, setIsPrivateModalOpen] = useState(false);

  if (!community) return null;

  return (
    <div className={styles.centered}>
      <EmptyState
        emoji={community.emoji}
        title={community.name}
        text={
          joinCommunity.isError
            ? getErrorMessage(joinCommunity.error)
            : `${community.description} · ${formatCount(community.membersCount)} участников`
        }
        action={
          community.isPrivate ? (
            <Button onClick={() => setIsPrivateModalOpen(true)}>Запросить доступ</Button>
          ) : (
            <Button onClick={() => joinCommunity.mutate(community.id)} disabled={joinCommunity.isPending}>
              Вступить в сообщество
            </Button>
          )
        }
      />
      {isPrivateModalOpen && (
        <PrivateAccessModal community={community} onClose={() => setIsPrivateModalOpen(false)} />
      )}
    </div>
  );
}
