"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button/Button";
import TextField from "@/components/ui/TextField/TextField";
import { useLogin } from "@/hooks/api/useAuth";
import { getErrorMessage } from "@/lib/api";
import { AuthHeader, Divider, FormError, GoogleButton, SwitchLink } from "../AuthParts/AuthParts";
import styles from "../AuthParts/AuthParts.module.css";

// Только внутренние адреса — чтобы ссылку входа нельзя было использовать для перехода на чужой сайт
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/communities");

// Вход по email и паролю. Пароль проверяет Supabase Auth (через Express API).
export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "Введи корректный email";
    if (!password) nextErrors.password = "Введи пароль";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    login.mutate(
      { email: email.trim(), password },
      { onSuccess: () => router.replace(safeNext(searchParams.get("next"))) },
    );
  };

  return (
    <>
      <AuthHeader title="С возвращением!" subtitle="Войди в свой аккаунт, чтобы продолжить" />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          label="Пароль"
          type="password"
          placeholder="Введи пароль"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />

        <div className={styles.optionsRow}>
          <span />
          <Link href="/forgot-password" className={styles.smallLink}>
            Забыли пароль?
          </Link>
        </div>

        {login.isError && <FormError>{getErrorMessage(login.error)}</FormError>}

        <Button type="submit" fullWidth disabled={login.isPending}>
          {login.isPending ? "Входим…" : "Войти"}
        </Button>

        <Divider />
        <GoogleButton />
      </form>

      <SwitchLink text="Нет аккаунта?" linkText="Создать" href="/register" />
    </>
  );
}
