"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/api/useAuth";
import { useProfile } from "@/hooks/api/useProfile";
import EmptyState from "@/components/ui/EmptyState/EmptyState";
import { getErrorMessage } from "@/lib/api";

// Страницы только для вошедших. Это удобство интерфейса (редирект на вход),
// а не защита: данные без действительного токена сервер всё равно не отдаст.
export default function RequireAuth({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isReady, isAuthenticated } = useAuth();
  const { data: profile, error } = useProfile();

  const needsLogin = isReady && !isAuthenticated;
  // Вошли через Google, но город и район ещё не выбраны — сначала заполняем профиль
  const needsProfile = profile !== undefined && !profile.isProfileComplete;

  useEffect(() => {
    if (needsLogin) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (needsProfile) router.replace("/complete-profile");
  }, [needsLogin, needsProfile, pathname, router]);

  if (error && !profile) return <EmptyState emoji="⚠️" title="Не удалось загрузить профиль" text={getErrorMessage(error)} />;
  if (!isReady || needsLogin || needsProfile || !profile) return fallback;
  return children;
}
