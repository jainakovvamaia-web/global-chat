import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button/Button";
import Modal from "@/components/ui/Modal/Modal";
import { useJoinByCode, useRequestAccess } from "@/hooks/api/useCommunities";
import { useJoinByInvitation } from "@/hooks/api/useInvitations";
import { getApiError, getErrorMessage } from "@/lib/api";
import type { Community } from "@/types";
import styles from "./PrivateAccessModal.module.css";

interface PrivateAccessModalProps {
  community: Community | null; // null — вход по коду без выбранного сообщества
  onClose: () => void;
}

// Вступление в закрытое сообщество: по коду приглашения или заявкой администратору.
// Без выбранного сообщества (кнопка «Войти по коду») — общий вход: код закрытой группы или сообщества.
export default function PrivateAccessModal({ community, onClose }: PrivateAccessModalProps) {
  const router = useRouter();
  const joinByCode = useJoinByCode();
  const joinByInvitation = useJoinByInvitation();
  const isJoining = joinByCode.isPending || joinByInvitation.isPending;
  const requestAccess = useRequestAccess();
  const isRequested = community?.requested === true || requestAccess.isSuccess;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!community) {
      // Сервер сам скажет, что не так: неверный код, истёк, отключён, лимит или вы уже участник
      joinByInvitation.mutate(code, {
        onSuccess: (result) => {
          onClose();
          router.push(result.href);
        },
        onError: (err) => setError(getErrorMessage(err)),
      });
      return;
    }
    joinByCode.mutate(code.trim().toUpperCase(), {
      onSuccess: (joined) => {
        onClose();
        router.push(`/${joined.id}/chat/general`);
      },
      onError: (err) =>
        setError(
          getApiError(err).status === 404 || getApiError(err).status === 400
            ? "Код не подошёл. Проверьте его или запросите доступ."
            : getErrorMessage(err),
        ),
    });
  };

  return (
    <Modal
      title={community ? community.name : "Вход по коду приглашения"}
      description={
        community
          ? "Введи код приглашения или запроси доступ у администратора"
          : "Введи код, который тебе дали, — откроется закрытая группа или сообщество"
      }
      icon="🔐"
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={`${styles.codeInput} ${error ? styles.invalid : ""}`}
          placeholder="Например, KNU-7F4X92QZ"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError("");
          }}
          aria-label="Код приглашения"
          aria-invalid={Boolean(error)}
          autoFocus
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth disabled={!code.trim() || isJoining}>
          {community ? "Присоединиться" : "Войти в группу"}
        </Button>
        {community && (
          <Button
            variant="secondary"
            fullWidth
            disabled={isRequested || requestAccess.isPending}
            onClick={() => requestAccess.mutate(community.id, { onError: (err) => setError(getErrorMessage(err)) })}
          >
            {isRequested ? "✓ Заявка отправлена" : "Запросить доступ"}
          </Button>
        )}
      </form>
    </Modal>
  );
}
