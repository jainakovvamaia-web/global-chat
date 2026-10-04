import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button/Button";
import TextField from "@/components/ui/TextField/TextField";
import { useChangePassword } from "@/hooks/api/useAuth";
import { useProfile } from "@/hooks/api/useProfile";
import { getErrorMessage } from "@/lib/api";
import styles from "./SettingsView.module.css";

// Те же правила, что проверяет сервер (validators/auth.validators.ts)
function checkNewPassword(password: string): string | null {
  if (password.length < 8) return "Пароль — минимум 8 символов";
  if (password.length > 72) return "Пароль — максимум 72 символа";
  if (!/[A-Za-zА-Яа-я]/.test(password)) return "В пароле нужна хотя бы одна буква";
  if (!/\d/.test(password)) return "В пароле нужна хотя бы одна цифра";
  return null;
}

// Смена пароля. Сервер проверяет текущий пароль; у аккаунта, созданного через Google,
// пароля нет — тогда его можно просто задать.
export default function SecuritySettings() {
  const { data: profile } = useProfile();
  const changePassword = useChangePassword();
  const hasPassword = profile?.hasPassword ?? true;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setIsDone(false);
    if (hasPassword && !currentPassword) {
      setError("Введите текущий пароль");
      return;
    }
    const problem = checkNewPassword(newPassword);
    if (problem) {
      setError(problem);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    setError("");
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setIsDone(true);
        },
        onError: (changeError) => setError(getErrorMessage(changeError)),
      },
    );
  };

  return (
    <div className={styles.group}>
      <h2 className={styles.groupTitle}>Безопасность</h2>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h3 className={styles.optionTitle}>{hasPassword ? "Изменить пароль" : "Задать пароль"}</h3>
        {hasPassword && (
          <TextField
            label="Текущий пароль"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        )}
        <TextField
          label="Новый пароль"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <TextField
          label="Подтвердить пароль"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <div>
          <Button type="submit" size="md" disabled={changePassword.isPending}>
            Обновить пароль
          </Button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {isDone && (
          <p className={styles.status} role="status">
            ✓ Пароль обновлён
          </p>
        )}
        <p className={styles.note}>
          {hasPassword
            ? "Минимум 8 символов, хотя бы одна буква и одна цифра."
            : "Вы вошли через Google. Задайте пароль, чтобы входить и по email."}
        </p>
      </form>
    </div>
  );
}
