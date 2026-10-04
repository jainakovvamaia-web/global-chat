import { Lock, Users } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from "@/lib/communities";
import { formatCount } from "@/lib/format";
import type { Community } from "@/types";
import styles from "./CommunityCard.module.css";

interface CommunityCardProps {
  community: Community;
  onJoin: () => void;
}

// Карточка сообщества на экране выбора
export default function CommunityCard({ community, onJoin }: CommunityCardProps) {
  const isRequested = community.requested;

  const buttonLabel = community.joined
    ? "✓ Открыть"
    : community.isPrivate
      ? isRequested
        ? "Заявка отправлена"
        : "Запросить доступ"
      : "Вступить";

  return (
    <article className={styles.card}>
      <div className={styles.cover}>
        <span aria-hidden="true">{community.emoji}</span>
        {community.isPrivate && (
          <span className={styles.privateBadge}>
            <Lock size={10} /> Закрытое
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.name}>{community.name}</h3>
          <span className={styles.category} title={CATEGORY_LABELS[community.category]}>
            {CATEGORY_EMOJIS[community.category]}
          </span>
        </div>
        <p className={styles.description}>{community.description}</p>

        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <Users size={14} aria-hidden="true" />
            {formatCount(community.membersCount)} участников
          </span>
          <span className={styles.metaItem}>
            <span className={styles.onlineDot} />
            {formatCount(community.onlineCount)} онлайн
          </span>
        </div>

        <Button variant={community.joined ? "soft" : "primary"} size="sm" fullWidth onClick={onJoin}>
          {buttonLabel}
        </Button>
      </div>
    </article>
  );
}
