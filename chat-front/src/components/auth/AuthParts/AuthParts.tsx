import Link from "next/link";
import { useState, type ReactNode } from "react";
import { signInWithGoogle } from "@/hooks/api/useAuth";
import { getErrorMessage } from "@/lib/api";
import LogoMark from "@/components/ui/LogoMark/LogoMark";
import styles from "./AuthParts.module.css";

// Общие части форм входа и регистрации

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Link href="/" className={styles.logo} aria-label="На главную">
        <span className={styles.logoMark}>
          <LogoMark size="lg" />
        </span>
        <span className={styles.logoText}>Global Chat</span>
      </Link>
      <h1 className={`${styles.title} ${subtitle ? "" : styles.titleAlone}`}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </>
  );
}

export function Divider() {
  return (
    <div className={styles.divider}>
      <span />
      или
      <span />
    </div>
  );
}

// Вход через Google (Supabase Auth OAuth). После входа Google вернёт пользователя на /auth/callback
export function GoogleButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle(); // дальше браузер уходит на страницу Google
    } catch (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <>
    <button type="button" className={styles.google} onClick={start} disabled={isLoading}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Продолжить с Google
    </button>
    {error && <FormError>{error}</FormError>}
    </>
  );
}

// Ошибка всей формы (ответ сервера: «Неверный email или пароль» и т.п.)
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p className={styles.error} role="alert">
      {children}
    </p>
  );
}

// Информационная строка под формой
export function DemoNotice({ children }: { children: ReactNode }) {
  return <p className={styles.demo}>{children}</p>;
}

export function SwitchLink({ text, linkText, href }: { text: string; linkText: string; href: string }) {
  return (
    <p className={styles.switch}>
      {text}{" "}
      <Link href={href} className={styles.switchLink}>
        {linkText}
      </Link>
    </p>
  );
}
