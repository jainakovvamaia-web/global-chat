import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  backHref?: string; // стрелка «назад», например из события в список событий
  icon?: ReactNode;
  actions?: ReactNode;
}

// Шапка раздела высотой 56px, как в макете: заголовок, подзаголовок и кнопки справа
export default function PageHeader({ title, subtitle, backHref, icon, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {backHref && (
        <Link href={backHref} className={styles.back} aria-label="Назад">
          <ArrowLeft size={20} />
        </Link>
      )}
      {icon}
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
