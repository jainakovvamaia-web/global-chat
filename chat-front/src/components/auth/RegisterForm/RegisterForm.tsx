"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import LocationEducationFields from "@/components/profile/LocationEducationFields/LocationEducationFields";
import Button from "@/components/ui/Button/Button";
import TextField from "@/components/ui/TextField/TextField";
import { EMPTY_LOCATION, validateLocation, type LocationErrors } from "@/lib/locations";
import { useRegister } from "@/hooks/api/useAuth";
import { getApiError } from "@/lib/api";
import type { LocationSelection } from "@/types";
import { AuthHeader, Divider, FormError, GoogleButton, SwitchLink } from "../AuthParts/AuthParts";
import styles from "../AuthParts/AuthParts.module.css";

interface AccountFields {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
  agreed: boolean;
}

type AccountErrors = Partial<Record<keyof AccountFields, string>>;

const EMPTY_ACCOUNT: AccountFields = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirm: "",
  agreed: false,
};

const PASSWORD_HINT = "Минимум 8 символов, хотя бы одна буква и одна цифра";

function validateAccount(values: AccountFields): AccountErrors {
  const errors: AccountErrors = {};
  if (!values.firstName.trim()) errors.firstName = "Введи имя";
  if (!values.lastName.trim()) errors.lastName = "Введи фамилию";
  if (!values.email.trim()) errors.email = "Введи email";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) errors.email = "Некорректный email";
  if (values.password.length < 8) errors.password = "Минимум 8 символов";
  else if (!/\p{L}/u.test(values.password) || !/\d/.test(values.password)) {
    errors.password = "Пароль должен содержать буквы и цифры";
  }
  if (!values.confirm) errors.confirm = "Повтори пароль";
  else if (values.password !== values.confirm) errors.confirm = "Пароли не совпадают";
  if (!values.agreed) errors.agreed = "Необходимо принять условия";
  return errors;
}

// Регистрация (ТЗ, п. 5.1) + место проживания и учёба — по ним сервер открывает «Мои чаты».
// Аккаунт создаёт Supabase Auth (пароль хранится только там), профиль — триггер в базе.
export default function RegisterForm() {
  const router = useRouter();
  const register = useRegister();

  const [account, setAccount] = useState<AccountFields>(EMPTY_ACCOUNT);
  const [location, setLocation] = useState<LocationSelection>(EMPTY_LOCATION);
  // Ошибки показываем после первой попытки отправки и дальше пересчитываем при каждом изменении,
  // поэтому исправленное поле сразу теряет свою ошибку
  const [isSubmitted, setIsSubmitted] = useState(false);

  const accountErrors: AccountErrors = isSubmitted ? validateAccount(account) : {};
  const locationErrors: LocationErrors = isSubmitted ? validateLocation(location) : {};

  const setField = <K extends keyof AccountFields>(field: K, value: AccountFields[K]) =>
    setAccount((previous) => ({ ...previous, [field]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitted(true);
    const hasErrors =
      Object.keys(validateAccount(account)).length > 0 || Object.keys(validateLocation(location)).length > 0;
    if (hasErrors) return;

    register.mutate(
      {
        firstName: account.firstName.trim(),
        lastName: account.lastName.trim(),
        email: account.email.trim(),
        password: account.password,
        location,
      },
      {
        onSuccess: (result) => {
          // Подтверждение email выключено — сессия уже есть, сразу к чатам
          if (!result.needsEmailConfirmation) router.replace("/communities");
        },
      },
    );
  };

  const serverError = register.isError ? getApiError(register.error) : null;

  if (register.data?.needsEmailConfirmation) {
    return (
      <div className={styles.sent}>
        <AuthHeader title="Подтвердите email" />
        <div className={styles.sentIcon} aria-hidden="true">
          <Mail size={32} />
        </div>
        <p className={styles.sentText}>
          Аккаунт создан. На адрес <strong>{account.email.trim()}</strong> отправлено письмо — перейдите по ссылке из
          него, чтобы войти.
        </p>
        <Button href="/login" fullWidth>
          Перейти ко входу
        </Button>
      </div>
    );
  }

  return (
    <>
      <AuthHeader title="Создать аккаунт" subtitle="Присоединяйся к своему сообществу" />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.row}>
          <TextField
            label="Имя"
            placeholder="Алина"
            autoComplete="given-name"
            value={account.firstName}
            onChange={(event) => setField("firstName", event.target.value)}
            error={accountErrors.firstName}
          />
          <TextField
            label="Фамилия"
            placeholder="Петрова"
            autoComplete="family-name"
            value={account.lastName}
            onChange={(event) => setField("lastName", event.target.value)}
            error={accountErrors.lastName}
          />
        </div>
        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={account.email}
          onChange={(event) => setField("email", event.target.value)}
          error={accountErrors.email}
        />
        <TextField
          label="Пароль"
          type="password"
          placeholder="Минимум 8 символов"
          autoComplete="new-password"
          value={account.password}
          onChange={(event) => setField("password", event.target.value)}
          error={accountErrors.password}
          hint={PASSWORD_HINT}
        />
        <TextField
          label="Подтверждение пароля"
          type="password"
          placeholder="Повтори пароль"
          autoComplete="new-password"
          value={account.confirm}
          onChange={(event) => setField("confirm", event.target.value)}
          error={accountErrors.confirm}
        />

        <LocationEducationFields value={location} onChange={setLocation} errors={locationErrors} />

        <label className={`${styles.checkbox} ${accountErrors.agreed ? styles.checkboxError : ""}`}>
          <input
            type="checkbox"
            checked={account.agreed}
            onChange={(event) => setField("agreed", event.target.checked)}
          />
          <span>
            Я принимаю <span className={styles.accentText}>Условия использования</span> и{" "}
            <span className={styles.accentText}>Политику конфиденциальности</span>
          </span>
        </label>
        {accountErrors.agreed && (
          <p className={styles.error} role="alert">
            {accountErrors.agreed}
          </p>
        )}

        {serverError && <FormError>{serverError.message}</FormError>}

        <Button type="submit" fullWidth disabled={register.isPending}>
          {register.isPending ? "Создаём аккаунт…" : "Создать аккаунт"}
        </Button>

        <Divider />
        <GoogleButton />
      </form>

      <SwitchLink text="Уже есть аккаунт?" linkText="Войти" href="/login" />
    </>
  );
}
