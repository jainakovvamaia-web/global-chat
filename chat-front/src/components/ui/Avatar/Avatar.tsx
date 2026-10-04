import { UserRound } from "lucide-react";
import { getAvatarColor, getInitials } from "@/lib/members";
import styles from "./Avatar.module.css";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const ICON_SIZES: Record<AvatarSize, number> = { xs: 12, sm: 16, md: 18, lg: 22, xl: 32 };

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  isOnline?: boolean;
}

// Круглый аватар с инициалами — только для собственного профиля.
// Фото профиля появится, когда будет Supabase Storage.
export default function Avatar({ name, size = "md", isOnline = false }: AvatarProps) {
  return (
    <span className={styles.wrapper}>
      <span
        className={`${styles.avatar} ${styles[size]}`}
        style={{ backgroundColor: getAvatarColor(name) }}
        aria-hidden="true"
      >
        {getInitials(name)}
      </span>
      {isOnline && <OnlineDot size={size} />}
    </span>
  );
}

// Нейтральный аватар анонимного автора: одинаковая иконка для всех, без личных данных
export function AnonymousAvatar({ size = "md", isOnline = false }: Omit<AvatarProps, "name">) {
  return (
    <span className={styles.wrapper}>
      <span className={`${styles.avatar} ${styles.anonymous} ${styles[size]}`} aria-hidden="true">
        <UserRound size={ICON_SIZES[size]} />
      </span>
      {isOnline && <OnlineDot size={size} />}
    </span>
  );
}

function OnlineDot({ size }: { size: AvatarSize }) {
  return <span className={`${styles.dot} ${styles[`dot-${size}`]}`} title="В сети" />;
}
