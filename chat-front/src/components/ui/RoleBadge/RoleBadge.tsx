import { ROLE_LABELS } from "@/lib/members";
import type { MemberRole } from "@/types";
import styles from "./RoleBadge.module.css";

// Цветная плашка роли: «Владелец», «Администратор», «Модератор», «Участник»
export default function RoleBadge({ role, size = "sm" }: { role: MemberRole; size?: "sm" | "md" }) {
  return <span className={`${styles.badge} ${styles[role]} ${styles[size]}`}>{ROLE_LABELS[role]}</span>;
}
