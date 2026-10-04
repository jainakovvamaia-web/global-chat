// Приглашения в группы и вход по коду.
// Коды групп и сообществ хранятся в одной таблице invitations (у кода ровно одна цель),
// проверяет и использует код функция базы redeem_invitation — одной транзакцией.

import { supabaseAdmin } from "../config/supabase";
import type { InvitationDto, JoinByInvitationDto } from "../types/dto";
import { apiErrors } from "../utils/apiErrors";
import { must } from "../utils/db";
import { generateInviteCode, redeemError, toInvitationDto } from "../utils/invitations";
import type { CreateChatInvitationInput } from "../validators/invitation.validators";
import { MANAGER_ROLES, requireCommunityRole } from "./access.service";
import { addAudit } from "./audit.service";
import { chatHref, getChat, requireManageableChat } from "./chat.service";
import { getCommunity } from "./community.service";

// Создать код может создатель группы или admin платформы. Код нужен только закрытым группам:
// в открытую группу пускает место из профиля.
export async function createChatInvitation(
  userId: string,
  chatId: string,
  input: CreateChatInvitationInput,
): Promise<InvitationDto> {
  const { chat } = await requireManageableChat(userId, chatId);
  if (!chat.is_private) {
    throw apiErrors.badRequest(
      "Приглашения нужны только закрытым группам: в открытую пускает место из профиля",
      "CHAT_IS_PUBLIC",
    );
  }
  const row = must(
    await supabaseAdmin
      .from("invitations")
      .insert({
        code: generateInviteCode(chat.name),
        chat_id: chat.id,
        created_by: userId,
        expires_at: input.expiresAt ?? null,
        max_uses: input.maxUses ?? null,
      })
      .select("*")
      .single(),
  );
  if (chat.community_id) await addAudit(chat.community_id, `Создан код приглашения в группу «${chat.name}»`);
  return toInvitationDto(row);
}

// Список кодов группы — только тем, кто может приглашать. Остальным коды не отдаются вообще.
export async function listChatInvitations(userId: string, chatId: string): Promise<InvitationDto[]> {
  await requireManageableChat(userId, chatId);
  const rows = must(
    await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(100),
  );
  return rows.map(toInvitationDto);
}

// Отключить код (is_active = false). Код группы — создатель или admin, код сообщества — его администраторы.
// Чужой код «не найден», чтобы нельзя было проверять, существуют ли id.
export async function deactivateInvitation(userId: string, invitationId: string): Promise<InvitationDto> {
  const invitation = must(
    await supabaseAdmin.from("invitations").select("*").eq("id", invitationId).maybeSingle(),
    "Приглашение не найдено",
  );
  if (invitation.chat_id) {
    try {
      await requireManageableChat(userId, invitation.chat_id);
    } catch {
      throw apiErrors.notFound("Приглашение не найдено");
    }
  } else if (invitation.community_id) {
    await requireCommunityRole(userId, invitation.community_id, MANAGER_ROLES);
  }
  if (!invitation.is_active) return toInvitationDto(invitation);

  const row = must(
    await supabaseAdmin
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .select("*")
      .single(),
  );
  if (invitation.community_id) await addAudit(invitation.community_id, `Отключён код приглашения ${row.code}`);
  return toInvitationDto(row);
}

// Вход по коду: подходит и для закрытых групп, и для закрытых сообществ.
// Проверки (активен, не истёк, лимит, уже участник) и вступление — в базе одной транзакцией.
export async function joinByInvitation(userId: string, code: string): Promise<JoinByInvitationDto> {
  const [result] = must(await supabaseAdmin.rpc("redeem_invitation", { p_code: code, p_user: userId }));
  if (!result) throw redeemError("not_found", "chat");
  const kind = result.chat_id ? "chat" : "community";
  if (result.status !== "joined") throw redeemError(result.status, kind);

  if (result.chat_id) {
    const chat = await getChat(userId, result.chat_id);
    if (chat.communityId) await addAudit(chat.communityId, `Новый участник вступил в группу «${chat.name}» по коду`);
    return {
      message: "Вы вступили в группу",
      kind: "chat",
      chat,
      href: await chatHref(userId, { id: chat.id, type: chat.type, community_id: chat.communityId }),
    };
  }
  if (!result.community_id) throw redeemError("not_found", "community");
  await addAudit(result.community_id, "Новый участник вступил по коду приглашения");
  const community = await getCommunity(userId, result.community_id);
  return { message: "Вы вступили в сообщество", kind: "community", community, href: `/${community.id}/chat/general` };
}
