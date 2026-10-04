import { useState } from "react";
import Button from "@/components/ui/Button/Button";
import Modal from "@/components/ui/Modal/Modal";
import { useDeleteChat } from "@/hooks/api/useChats";
import { useChatInvitations, useCreateChatInvitation, useDeactivateInvitation } from "@/hooks/api/useInvitations";
import { getErrorMessage } from "@/lib/api";
import type { ChatAccessType, Id, Invitation } from "@/types";
import adminStyles from "@/components/admin/AdminView/AdminView.module.css";
import InvitationOptionsFields from "./InvitationOptionsFields";
import { describeInvitation, toInvitationInput, type ExpiryValue, type MaxUsesValue } from "./invitationOptions";
import styles from "./ChatInvitesModal.module.css";

export interface ManagedChat {
  id: Id;
  name: string;
  emoji: string;
  access: ChatAccessType;
  communityId: Id | null;
}

interface ChatInvitesModalProps {
  chat: ManagedChat;
  onClose: () => void;
  onDeleted: () => void;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// «Пригласить участников» и управление группой — для создателя группы и admin.
// Список кодов приходит только им: сервер не отдаёт коды остальным.
export default function ChatInvitesModal({ chat, onClose, onDeleted }: ChatInvitesModalProps) {
  const isPrivate = chat.access === "private";
  const invitationsQuery = useChatInvitations(chat.id, isPrivate);
  const createInvitation = useCreateChatInvitation(chat.id);
  const deactivate = useDeactivateInvitation(chat.id);
  const deleteChat = useDeleteChat();

  const [expiry, setExpiry] = useState<ExpiryValue>("7d");
  const [maxUses, setMaxUses] = useState<MaxUsesValue>("10");
  const [copiedId, setCopiedId] = useState<Id | null>(null);
  const [error, setError] = useState("");

  const created = createInvitation.data ?? null;
  const invitations = invitationsQuery.data ?? [];

  const copy = async (invitation: Invitation) => {
    if (await copyText(invitation.code)) setCopiedId(invitation.id);
    else setError("Не удалось скопировать — выделите код вручную");
  };

  const handleDelete = () => {
    if (!window.confirm(`Удалить группу «${chat.name}»? Сообщения и коды приглашений будут удалены.`)) return;
    deleteChat.mutate(chat, { onSuccess: onDeleted, onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <Modal
      title={isPrivate ? "Пригласить участников" : "Управление группой"}
      description={chat.name}
      icon={chat.emoji}
      onClose={onClose}
      size="md"
    >
      <div className={styles.body}>
        {isPrivate ? (
          <>
            <InvitationOptionsFields
              expiry={expiry}
              maxUses={maxUses}
              onExpiryChange={setExpiry}
              onMaxUsesChange={setMaxUses}
            />
            <Button
              fullWidth
              disabled={createInvitation.isPending}
              onClick={() =>
                createInvitation.mutate(toInvitationInput(expiry, maxUses), {
                  onError: (err) => setError(getErrorMessage(err)),
                })
              }
            >
              Создать код приглашения
            </Button>

            {created && (
              <div className={adminStyles.inviteResult}>
                <div className={adminStyles.inviteCode}>{created.code}</div>
                <p className={adminStyles.muted}>{describeInvitation(created).meta}</p>
                <Button variant="soft" fullWidth onClick={() => void copy(created)}>
                  {copiedId === created.id ? "✓ Код скопирован" : "Скопировать код"}
                </Button>
              </div>
            )}

            <div className={adminStyles.sectionHeader}>
              <h3 className={adminStyles.cardTitle}>Коды приглашений</h3>
            </div>
            {invitations.length === 0 ? (
              <p className={adminStyles.muted}>
                {invitationsQuery.isLoading ? "Загрузка…" : "Кодов пока нет — создайте первый"}
              </p>
            ) : (
              <ul className={`${adminStyles.rows} ${styles.list}`}>
                {invitations.map((invitation) => {
                  const { meta, status } = describeInvitation(invitation);
                  return (
                    <li key={invitation.id} className={adminStyles.row}>
                      <div className={adminStyles.rowText}>
                        <div className={adminStyles.rowTitle}>
                          <span className={styles.code}>{invitation.code}</span>
                          {status && <span className={styles.status}>{status}</span>}
                        </div>
                        <div className={adminStyles.rowMeta}>{meta}</div>
                      </div>
                      {invitation.isActive && (
                        <div className={adminStyles.rowActions}>
                          <Button variant="neutral" size="xs" onClick={() => void copy(invitation)}>
                            {copiedId === invitation.id ? "✓" : "Копировать"}
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            disabled={deactivate.isPending}
                            onClick={() =>
                              deactivate.mutate(invitation.id, { onError: (err) => setError(getErrorMessage(err)) })
                            }
                          >
                            Отключить
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <p className={adminStyles.muted}>
            Группа открытая: её видят все, кому она подходит по городу, району или учебному заведению.
            Коды приглашений нужны только закрытым группам.
          </p>
        )}

        {error && (
          <p className={adminStyles.muted} role="alert">
            ⚠️ {error}
          </p>
        )}

        <div className={styles.footer}>
          <Button variant="dangerOutline" fullWidth disabled={deleteChat.isPending} onClick={handleDelete}>
            Удалить группу
          </Button>
        </div>
      </div>
    </Modal>
  );
}
