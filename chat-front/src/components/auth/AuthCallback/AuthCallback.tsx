"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button/Button";
import { useAuth } from "@/hooks/api/useAuth";
import { completeAuthFromUrl } from "@/lib/supabase";
import { AuthHeader } from "../AuthParts/AuthParts";
import styles from "../AuthParts/AuthParts.module.css";

// Возврат из Google или переход по ссылке из письма: завершаем вход (completeAuthFromUrl).
// Как только сессия появилась — ведём к чатам; без города RequireAuth отправит заполнять профиль.
export default function AuthCallback() {
  const router = useRouter();
  const { isReady, isAuthenticated } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    void completeAuthFromUrl().then((error) => {
      setUrlError(error);
      setIsProcessing(false);
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) router.replace("/communities");
  }, [isAuthenticated, router]);

  // isReady ложно при первой отрисовке — сервер и браузер рисуют одно и то же
  if (isReady && !isProcessing && (urlError || !isAuthenticated)) {
    return (
      <div className={styles.sent}>
        <AuthHeader title="Не удалось войти" />
        <p className={styles.sentText}>{urlError ?? "Ссылка устарела или уже была использована. Попробуйте войти ещё раз."}</p>
        <Button href="/login" fullWidth>
          Ко входу
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.sent}>
      <AuthHeader title="Входим…" />
    </div>
  );
}
