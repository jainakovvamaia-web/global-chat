"use client";

import { useEffect, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button/Button";
import TextField from "@/components/ui/TextField/TextField";
import { useAuth, useResetPassword } from "@/hooks/api/useAuth";
import { getErrorMessage } from "@/lib/api";
import { completeAuthFromUrl } from "@/lib/supabase";
import { AuthHeader, FormError } from "../AuthParts/AuthParts";
import styles from "../AuthParts/AuthParts.module.css";

// Новый пароль по ссылке из письма. Ссылка создаёт временную сессию восстановления,
// с ней сервер разрешает сменить пароль.
export default function ResetPasswordForm() {
  const { isReady, isAuthenticated } = useAuth();
  const changePassword = useResetPassword();
  const [isProcessing, setIsProcessing] = useState(true);

  // Сессия восстановления приходит в адресе ссылки из письма
  useEffect(() => {
    void completeAuthFromUrl().then(() => setIsProcessing(false));
  }, []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
      setError("Минимум 8 символов, хотя бы одна буква и одна цифра");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setError(null);
    changePassword.mutate(password);
  };

  if (changePassword.isSuccess) {
    return (
      <div className={styles.sent}>
        <AuthHeader title="Пароль изменён" />
        <Button href="/communities" fullWidth>
          Перейти к моим чатам
        </Button>
      </div>
    );
  }

  if (isReady && !isProcessing && !isAuthenticated) {
    return (
      <div className={styles.sent}>
        <AuthHeader title="Ссылка недействительна" />
        <p className={styles.sentText}>Ссылка устарела или уже была использована. Запросите новую.</p>
        <Button href="/forgot-password" fullWidth>
          Запросить ссылку
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeader title="Новый пароль" subtitle="Придумай новый пароль для входа" />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Новый пароль"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="Минимум 8 символов, хотя бы одна буква и одна цифра"
        />
        <TextField
          label="Подтверждение пароля"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {(error ?? changePassword.error) && <FormError>{error ?? getErrorMessage(changePassword.error)}</FormError>}
        <Button type="submit" fullWidth disabled={!isAuthenticated || changePassword.isPending}>
          {changePassword.isPending ? "Сохраняем…" : "Сохранить пароль"}
        </Button>
      </form>
    </>
  );
}
