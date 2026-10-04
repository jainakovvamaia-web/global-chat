import CommunityShell from "@/components/layout/CommunityShell/CommunityShell";
import RequireAuth from "@/components/providers/RequireAuth";
import styles from "./layout.module.css";

// Все разделы сообщества открываются внутри общей оболочки (боковые панели + навигация).
// Данные приходят из API после входа, поэтому оболочка рисуется только в браузере.
export default function CommunityLayout({ children }: LayoutProps<"/[communityId]">) {
  return (
    <RequireAuth fallback={<div className={styles.loading}>Загрузка…</div>}>
      <CommunityShell>{children}</CommunityShell>
    </RequireAuth>
  );
}
