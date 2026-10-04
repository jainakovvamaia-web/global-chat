import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { formatCount, formatRelative } from "@/lib/format";
import { useAuditLog, useCommunityStats } from "@/hooks/api/useCommunities";
import styles from "./AdminView.module.css";

// Вкладка «Обзор»: ключевые цифры и журнал последних действий
export default function AdminOverview() {
  const { communityId, community } = useCurrentCommunity();
  const { data: stats } = useCommunityStats(communityId);
  const { data: auditLog = [] } = useAuditLog(communityId);

  if (!community) return null;

  const cards = [
    { label: "Участников", value: formatCount(stats?.membersCount ?? community.membersCount), icon: "👥", tone: styles.blue },
    { label: "Онлайн", value: formatCount(stats?.onlineCount ?? community.onlineCount), icon: "🟢", tone: styles.green },
    { label: "Каналов", value: stats ? String(stats.channelsCount) : "…", icon: "📌", tone: styles.purple },
    { label: "Активность / 7д", value: stats ? formatCount(stats.weeklyMessages) : "…", icon: "📈", tone: styles.amber },
  ];

  const recent = auditLog.slice(0, 6);

  return (
    <div className={styles.stack}>
      <div className={styles.stats}>
        {cards.map((stat) => (
          <div key={stat.label} className={`${styles.stat} ${stat.tone}`}>
            <div className={styles.statIcon} aria-hidden="true">
              {stat.icon}
            </div>
            <div className={styles.statValue}>{stat.value}</div>
            <div className={styles.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Последние действия</h3>
        {recent.length === 0 ? (
          <p className={styles.muted}>Пока ничего не происходило</p>
        ) : (
          <ul className={styles.log}>
            {recent.map((entry) => (
              <li key={entry.id} className={styles.logRow}>
                <span>{entry.text}</span>
                <span className={styles.logTime}>{formatRelative(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
