import { useState } from "react";
import Button from "@/components/ui/Button/Button";
import Modal from "@/components/ui/Modal/Modal";
import { useCreateInvitation } from "@/hooks/api/useCommunities";
import { getErrorMessage } from "@/lib/api";
import { formatFullDate } from "@/lib/format";
import styles from "./AdminView.module.css";

// Создание кода приглашения: его вводят в окне «Войти по коду» на экране сообществ
export default function InviteModal({ communityId, onClose }: { communityId: string; onClose: () => void }) {
  const createInvitation = useCreateInvitation(communityId);
  const invitation = createInvitation.data ?? null;
  const code = invitation?.code ?? null;
  const [copyStatus, setCopyStatus] = useState("");

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("Код скопирован");
    } catch {
      setCopyStatus("Не удалось скопировать — выделите код вручную");
    }
  };

  return (
    <Modal
      title="Пригласить участников"
      description="Создай код и отправь его тем, кого хочешь пригласить"
      icon="✉️"
      onClose={onClose}
    >
      {code ? (
        <div className={styles.inviteResult}>
          <div className={styles.inviteCode}>{code}</div>
          {invitation?.expiresAt && (
            <p className={styles.muted}>Код действует до {formatFullDate(invitation.expiresAt)}</p>
          )}
          <Button fullWidth onClick={copy}>
            Скопировать код
          </Button>
          {copyStatus && (
            <p className={styles.muted} role="status">
              {copyStatus}
            </p>
          )}
        </div>
      ) : (
        <div className={styles.inviteResult}>
          <Button fullWidth onClick={() => createInvitation.mutate()} disabled={createInvitation.isPending}>
            Создать код приглашения
          </Button>
          {createInvitation.isError && (
            <p className={styles.muted} role="alert">
              {getErrorMessage(createInvitation.error)}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
