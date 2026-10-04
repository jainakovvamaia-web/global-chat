import { useCallback, useRef, useState } from "react";
import { AnonymousAvatar } from "@/components/ui/Avatar/Avatar";
import Button from "@/components/ui/Button/Button";
import RoleBadge from "@/components/ui/RoleBadge/RoleBadge";
import { useCurrentCommunity } from "@/hooks/useCurrentCommunity";
import { useDismiss } from "@/hooks/useDismiss";
import { ROLE_LABELS } from "@/lib/members";
import { useAnswerJoinRequest, useJoinRequests, useRemoveMember, useSetMemberRole } from "@/hooks/api/useCommunities";
import { getErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { Member, MemberRole } from "@/types";
import InviteModal from "./InviteModal";
import styles from "./AdminView.module.css";

// Роли, которые может назначить администратор (владелец назначается только передачей прав)
const ASSIGNABLE_ROLES: MemberRole[] = ["admin", "moderator", "member"];

// Вкладка «Участники»: смена ролей, удаление и приглашения.
// Все участники анонимны: сервер отдаёт только роль, «онлайн» и непрозрачный id участника
export default function AdminMembers() {
  const { communityId, community, members } = useCurrentCommunity();
  const removeMember = useRemoveMember(communityId);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const remove = (member: Member) => {
    if (window.confirm("Удалить этого участника из сообщества?")) {
      removeMember.mutate(member.id, { onError: (err) => window.alert(getErrorMessage(err)) });
    }
  };

  return (
    <div className={styles.stack}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.cardTitle}>Управление участниками</h3>
        <Button variant="ghost" size="xs" onClick={() => setIsInviteOpen(true)}>
          + Пригласить
        </Button>
      </div>

      <ul className={styles.rows}>
        {members.map((member) => {
          // Администратор тоже видит участников анонимно.
          // Нельзя менять роль владельца и свою собственную (сервер проверяет то же самое)
          const isEditable = member.role !== "owner" && !member.isSelf;
          return (
            <li key={member.id} className={styles.row}>
              <AnonymousAvatar size="sm" isOnline={member.isOnline} />
              <div className={styles.rowText}>
                <div className={styles.rowTitle}>
                  {member.displayName}
                  <RoleBadge role={member.role} />
                </div>
                <div className={styles.rowMeta}>{member.isOnline ? "онлайн" : "не в сети"}</div>
              </div>
              {isEditable && (
                <div className={styles.rowActions}>
                  <RoleMenu communityId={communityId} member={member} />
                  <Button variant="danger" size="xs" onClick={() => remove(member)}>
                    Удалить
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {community?.isPrivate && <JoinRequests communityId={communityId} />}

      {isInviteOpen && <InviteModal communityId={communityId} onClose={() => setIsInviteOpen(false)} />}
    </div>
  );
}

// Кнопка «Роль» с выпадающим списком ролей
function RoleMenu({ communityId, member }: { communityId: string; member: Member }) {
  const setMemberRole = useSetMemberRole(communityId);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useDismiss(menuRef, isOpen, close);

  return (
    <div className={styles.menuWrapper} ref={menuRef}>
      <Button
        variant="neutral"
        size="xs"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        Роль
      </Button>
      {isOpen && (
        <div className={styles.menu} role="menu">
          {ASSIGNABLE_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              role="menuitemradio"
              aria-checked={member.role === role}
              className={`${styles.menuItem} ${member.role === role ? styles.menuItemActive : ""}`}
              onClick={() => {
                if (role !== "owner") {
                  setMemberRole.mutate(
                    { memberId: member.id, role },
                    { onError: (err) => window.alert(getErrorMessage(err)) },
                  );
                }
                close();
              }}
            >
              {ROLE_LABELS[role]}
              {member.role === role && " ✓"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Заявки на вступление в закрытое сообщество. Кто подал заявку, не показывается — чат анонимный
function JoinRequests({ communityId }: { communityId: string }) {
  const requestsQuery = useJoinRequests(communityId);
  const answer = useAnswerJoinRequest(communityId);
  const requests = requestsQuery.data ?? [];

  const reply = (requestId: string, approve: boolean) =>
    answer.mutate({ requestId, approve }, { onError: (err) => window.alert(getErrorMessage(err)) });

  return (
    <>
      <div className={styles.sectionHeader}>
        <h3 className={styles.cardTitle}>Заявки на вступление</h3>
      </div>
      {requests.length === 0 ? (
        <p className={styles.muted}>Новых заявок нет</p>
      ) : (
        <ul className={styles.rows}>
          {requests.map((request) => (
            <li key={request.requestId} className={styles.row}>
              <AnonymousAvatar size="sm" />
              <div className={styles.rowText}>
                <div className={styles.rowTitle}>Анонимно</div>
                <div className={styles.rowMeta}>заявка {formatRelative(request.createdAt)}</div>
              </div>
              <div className={styles.rowActions}>
                <Button size="xs" disabled={answer.isPending} onClick={() => reply(request.requestId, true)}>
                  Принять
                </Button>
                <Button variant="danger" size="xs" disabled={answer.isPending} onClick={() => reply(request.requestId, false)}>
                  Отклонить
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
