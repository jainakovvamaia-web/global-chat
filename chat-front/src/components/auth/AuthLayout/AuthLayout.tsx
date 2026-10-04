import type { ReactNode } from "react";
import { MessagesSquare } from "lucide-react";
import styles from "./AuthLayout.module.css";

const STATS = [
  { value: "1 240", label: "участников" },
  { value: "86", label: "онлайн" },
  { value: "6", label: "каналов" },
];

// Слева — декоративная панель с отзывом (только на больших экранах), справа — форма
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <aside className={styles.panel} aria-hidden="true">
        <div className={styles.rings}>
          {[1, 2, 3, 4, 5, 6].map((index) => (
            <span key={index} className={styles.ring} style={{ width: index * 120, height: index * 120 }} />
          ))}
        </div>

        <div className={styles.panelTop}>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>
              <MessagesSquare size={18} />
            </span>
            Global Chat
          </div>
          <blockquote className={styles.quote}>
            «Нашёл всех однокурсников через пять минут после регистрации. Теперь вся группа общается здесь.»
          </blockquote>
          <div className={styles.author}>
            <span className={styles.authorAvatar}>АП</span>
            <div>
              <div className={styles.authorName}>Алина Петрова</div>
              <div className={styles.authorPlace}>Школа №61</div>
            </div>
          </div>
        </div>

        <div className={styles.stats}>
          {STATS.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </aside>

      <main className={styles.formSide}>
        <div className={styles.formBox}>{children}</div>
      </main>
    </div>
  );
}
