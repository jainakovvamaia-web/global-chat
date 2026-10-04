import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button/Button";
import TextField from "@/components/ui/TextField/TextField";
import { useChangeEmail, useDeleteAccount, useLogout } from "@/hooks/api/useAuth";
import { useProfile, useUpdateProfile } from "@/hooks/api/useProfile";
import { getErrorMessage } from "@/lib/api";
import type { Profile } from "@/types";
import styles from "./SettingsView.module.css";

// Аккаунт: имя, фамилия, email + выход и удаление аккаунта
export default function AccountSettings() {
  const { data: profile } = useProfile();
  // Форма создаётся, когда профиль уже загружен, — так начальные значения полей всегда верные
  return profile ? <AccountForm key={profile.id} profile={profile} /> : null;
}

function AccountForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const changeEmail = useChangeEmail();
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();

  const [email, setEmail] = useState(profile.email);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const isSaving = updateProfile.isPending || changeEmail.isPending;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Имя и фамилия не могут быть пустыми");
      return;
    }
    const nextEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setError("Некорректный email");
      return;
    }
    setError("");
    setStatus("");
    try {
      const messages: string[] = [];
      if (firstName.trim() !== profile.firstName || lastName.trim() !== profile.lastName) {
        await updateProfile.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim() });
        messages.push("✓ Изменения сохранены");
      }
      if (nextEmail !== profile.email) {
        await changeEmail.mutateAsync(nextEmail);
        messages.push(`✉️ Мы отправили письмо на ${nextEmail} — email сменится после подтверждения`);
      }
      setStatus(messages.join(". ") || "Нет изменений");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    }
  };

  const resetStatus = () => {
    setStatus("");
    setError("");
  };

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => router.push("/") });
  };

  const handleDelete = () => {
    if (!window.confirm("Удалить аккаунт навсегда? Ваши сообщения, профиль и участие в сообществах будут удалены.")) {
      return;
    }
    deleteAccount.mutate(undefined, {
      onSuccess: () => router.push("/"),
      onError: (deleteError) => setError(getErrorMessage(deleteError)),
    });
  };

  return (
    <form className={styles.group} onSubmit={handleSubmit}>
      <h2 className={styles.groupTitle}>Настройки аккаунта</h2>
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          resetStatus();
        }}
      />
      <TextField
        label="Имя"
        value={firstName}
        maxLength={100}
        onChange={(event) => {
          setFirstName(event.target.value);
          resetStatus();
        }}
      />
      <TextField
        label="Фамилия"
        value={lastName}
        maxLength={100}
        onChange={(event) => {
          setLastName(event.target.value);
          resetStatus();
        }}
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className={styles.status} role="status">
          {status}
        </p>
      )}

      <div className={styles.footer}>
        <Button type="submit" fullWidth disabled={isSaving}>
          Сохранить изменения
        </Button>
        <Button variant="secondary" fullWidth onClick={handleLogout} disabled={logout.isPending}>
          Выйти из аккаунта
        </Button>
        <Button variant="dangerOutline" fullWidth onClick={handleDelete} disabled={deleteAccount.isPending}>
          Удалить аккаунт
        </Button>
      </div>
    </form>
  );
}
