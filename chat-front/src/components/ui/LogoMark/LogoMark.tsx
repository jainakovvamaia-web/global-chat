import { MessagesSquare } from "lucide-react";
import styles from "./LogoMark.module.css";

// Квадратный логотип Global Chat: 28 / 32 / 40 px, как в разных местах макета
const ICON_SIZES = { sm: 14, md: 16, lg: 20 } as const;

export default function LogoMark({ size = "md" }: { size?: keyof typeof ICON_SIZES }) {
  return (
    <span className={`${styles.logo} ${styles[size]}`} aria-hidden="true">
      <MessagesSquare size={ICON_SIZES[size]} strokeWidth={2} />
    </span>
  );
}
