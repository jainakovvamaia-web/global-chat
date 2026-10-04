"use client";

import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import Button from "@/components/ui/Button/Button";
import TextField from "@/components/ui/TextField/TextField";
import { useForgotPassword } from "@/hooks/api/useAuth";
import { getErrorMessage } from "@/lib/api";
import { AuthHeader, FormError, SwitchLink } from "../AuthParts/AuthParts";
import styles from "../AuthParts/AuthParts.module.css";

// Восстановление пароля: Supabase отправляет письмо со ссылкой на /auth/reset-password
export default function ForgotPasswordForm() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState("");

  const isValid = /^\S+@\S+\.\S+$/.test(email);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isValid) forgot.mutate(email.trim());
  };

  if (forgot.isSuccess) {
    return (
      <div className={styles.sent}>
        <AuthHeader title="Проверь почту" />
        <div className={styles.sentIcon} aria-hidden="true">
          <Mail size={32} />
        </div>
        <p className={styles.sentText}>
          Если адрес <strong>{email}</strong> зарегистрирован, на него придёт ссылка для создания нового пароля.
        </p>
        <Button href="/login" fullWidth>
          Вернуться ко входу
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeader
        title="Восстановление пароля"
        subtitle="Введи email, и мы отправим тебе ссылку для создания нового пароля"
      />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {forgot.isError && <FormError>{getErrorMessage(forgot.error)}</FormError>}
        <Button type="submit" fullWidth disabled={!isValid || forgot.isPending}>
          {forgot.isPending ? "Отправляем…" : "Отправить ссылку"}
        </Button>
      </form>
      <SwitchLink text="" linkText="← Назад ко входу" href="/login" />
    </>
  );
}
