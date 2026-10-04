import Link from "next/link";
import { sectionHref, type NavItem } from "../navItems";
import styles from "./NavButton.module.css";

interface NavButtonProps {
  item: NavItem;
  communityId: string;
  isActive: boolean;
  className: string;
  activeClassName: string;
  showLabel?: boolean;
  badge?: number;
}

// Ссылка на раздел сообщества с иконкой и (необязательно) красным счётчиком
export default function NavButton({
  item,
  communityId,
  isActive,
  className,
  activeClassName,
  showLabel = false,
  badge = 0,
}: NavButtonProps) {
  const Icon = item.icon;

  return (
    <Link
      href={sectionHref(communityId, item.key)}
      className={`${className} ${isActive ? activeClassName : ""}`}
      aria-label={badge ? `${item.label}: ${badge} новых` : item.label}
      aria-current={isActive ? "page" : undefined}
      title={item.label}
    >
      <span className={styles.iconWrapper}>
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
        {badge > 0 && <span className={styles.badge}>{badge > 9 ? "9+" : badge}</span>}
      </span>
      {showLabel && <span>{item.shortLabel}</span>}
    </Link>
  );
}
