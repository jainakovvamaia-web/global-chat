// Сообщения в чатах и каналах.
// Анонимность: в ответ НЕ попадает user_id автора — только isMine для своих сообщений
// и author = { displayName: "Анонимно" } для всех.

import { supabaseAdmin } from "../config/supabase";
import type { CommunityRole, MessageRow } from "../types/database.types";
import type { MessageDto, Paginated, ReactionDto } from "../types/dto";
import { ANONYMOUS_AUTHOR } from "../utils/anonymity";
import { apiErrors } from "../utils/apiErrors";
import { check, escapeLike, maybe, must } from "../utils/db";
import type { MessagesQuery, SendMessageInput } from "../validators/chat.validators";
import { getMyRole, MODERATOR_ROLES, requireChannelAccess, requireChatAccess } from "./access.service";
import { chatHref } from "./chat.service";
import { notifyUsers } from "./notification.service";
import { isPlatformAdmin } from "./user.service";
import { publishMessage, publishMessageDeleted, stopTypingFor } from "../realtime/realtime.service";

export type MessageTarget = { kind: "chat"; id: string } | { kind: "channel"; id: string };

// Контекст места: кто может писать, кто модерирует, куда вести ссылку из уведомления
interface TargetContext {
  communityId: string | null;
  role: CommunityRole | null;
  isAnnouncements: boolean;
  hrefFor: (recipientId: string) => Promise<string | null>;
}

async function resolveTarget(userId: string, target: MessageTarget): Promise<TargetContext> {
  if (target.kind === "channel") {
    const { channel, role } = await requireChannelAccess(userId, target.id);
    const href = `/${channel.community_id}/chat/${encodeURIComponent(channel.name)}`;
    return {
      communityId: channel.community_id,
      role,
      isAnnouncements: channel.is_announcements,
      hrefFor: async () => href,
    };
  }
  const chat = await requireChatAccess(userId, target.id);
  if (chat.type === "local" && chat.community_id) {
    const communityId = chat.community_id;
    return {
      communityId,
      role: await getMyRole(userId, communityId),
      isAnnouncements: false,
      hrefFor: async () => `/${communityId}/nearby/${chat.id}`,
    };
  }
  // Чат по месту открывается внутри любого сообщества получателя
  return {
    communityId: null,
    role: null,
    isAnnouncements: false,
    hrefFor: (recipientId) => chatHref(recipientId, chat),
  };
}

const targetColumn = (target: MessageTarget) => (target.kind === "chat" ? "chat_id" : "channel_id");

// ── Преобразование в DTO ─────────────────────────────────────────────────────
// Данные для DTO загружаются один раз (реакции, цитаты), а DTO собирается для конкретного
// зрителя: у каждого свой isMine и reactedByMe. Так одно событие WebSocket уходит всем
// подписчикам без лишних запросов к базе, и чужой user_id никому не передаётся.

interface MessageContext {
  reactions: Map<string, { emoji: string; userIds: string[] }[]>;
  replyById: Map<string, { id: string; content: string }>;
}

async function loadMessageContext(rows: MessageRow[]): Promise<MessageContext> {
  const ids = rows.map((row) => row.id);
  const replyIds = [...new Set(rows.map((row) => row.reply_to_id).filter((id): id is string => id !== null))];

  const [reactions, replies] = await Promise.all([
    supabaseAdmin.from("message_reactions").select("message_id, user_id, emoji, created_at").in("message_id", ids),
    replyIds.length > 0
      ? supabaseAdmin.from("messages").select("id, content").in("id", replyIds)
      : Promise.resolve({ data: [] as { id: string; content: string }[], error: null }),
  ]);

  const byMessage = new Map<string, { emoji: string; userIds: string[] }[]>();
  for (const reaction of must(reactions).sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const list = byMessage.get(reaction.message_id) ?? [];
    let item = list.find((entry) => entry.emoji === reaction.emoji);
    if (!item) {
      item = { emoji: reaction.emoji, userIds: [] };
      list.push(item);
    }
    item.userIds.push(reaction.user_id);
    byMessage.set(reaction.message_id, list);
  }
  return { reactions: byMessage, replyById: new Map(must(replies).map((reply) => [reply.id, reply])) };
}

// Реакции: количество и отметка «моя»; кто именно поставил — не сообщаем
function renderMessage(row: MessageRow, context: MessageContext, viewerId: string): MessageDto {
  const reply = row.reply_to_id ? context.replyById.get(row.reply_to_id) : undefined;
  const reactions: ReactionDto[] = (context.reactions.get(row.id) ?? []).map((item) => ({
    emoji: item.emoji,
    count: item.userIds.length,
    reactedByMe: item.userIds.includes(viewerId),
  }));
  return {
    id: row.id,
    chatId: row.chat_id,
    channelId: row.channel_id,
    type: row.type,
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    replyToId: row.reply_to_id,
    replyTo: reply ? { id: reply.id, content: reply.content.slice(0, 200), author: ANONYMOUS_AUTHOR } : null,
    author: ANONYMOUS_AUTHOR,
    isMine: row.user_id !== null && row.user_id === viewerId,
    reactions,
  };
}

async function toMessageDtos(viewerId: string, rows: MessageRow[]): Promise<MessageDto[]> {
  if (rows.length === 0) return [];
  const context = await loadMessageContext(rows);
  return rows.map((row) => renderMessage(row, context, viewerId));
}

// Место сообщения из самой строки: ровно одно из chat_id / channel_id
const targetOfRow = (row: MessageRow): MessageTarget =>
  row.chat_id ? { kind: "chat", id: row.chat_id } : { kind: "channel", id: row.channel_id ?? "" };

// После успешной записи в базу — событие подписчикам места через WebSocket и DTO для того,
// кто сделал запрос. Данные загружаются один раз на всех; сбой рассылки ответ REST не ломает.
async function publishAndRender(
  type: "new_message" | "message_updated",
  row: MessageRow,
  viewerId: string,
): Promise<MessageDto> {
  const context = await loadMessageContext([row]);
  publishMessage(type, targetOfRow(row), (recipientId) => renderMessage(row, context, recipientId));
  return renderMessage(row, context, viewerId);
}

// ── Чтение ───────────────────────────────────────────────────────────────────

export async function listMessages(
  userId: string,
  target: MessageTarget,
  query: MessagesQuery,
): Promise<Paginated<MessageDto>> {
  await resolveTarget(userId, target);
  let request = supabaseAdmin
    .from("messages")
    .select("*")
    .eq(targetColumn(target), target.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(query.limit + 1);
  if (query.before) {
    const [createdAt, id] = query.before.split("|");
    if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) throw apiErrors.badRequest("Неверный курсор");
    // (created_at, id) < (курсор): старше по времени, а при равном времени — меньше по id
    request = request.or(`created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id})`);
  }
  if (query.q) request = request.ilike("content", `%${escapeLike(query.q)}%`);

  const rows = must(await request);
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit).reverse(); // в интерфейсе — от старых к новым
  const oldest = page[0];
  return {
    items: await toMessageDtos(userId, page),
    nextCursor: hasMore && oldest ? `${oldest.created_at}|${oldest.id}` : null,
  };
}

export async function getMessageDto(userId: string, messageId: string): Promise<MessageDto> {
  const row = await getAccessibleMessage(userId, messageId);
  const [dto] = await toMessageDtos(userId, [row.message]);
  if (!dto) throw apiErrors.notFound("Сообщение не найдено");
  return dto;
}

// ── Отправка ─────────────────────────────────────────────────────────────────

export async function sendMessage(userId: string, target: MessageTarget, input: SendMessageInput): Promise<MessageDto> {
  const context = await resolveTarget(userId, target);
  if (context.isAnnouncements && !(context.role && MODERATOR_ROLES.includes(context.role))) {
    throw apiErrors.forbidden("В канал объявлений пишут только администраторы и модераторы", "ANNOUNCEMENTS_ONLY");
  }

  // Ответ — только на сообщение из этого же чата
  let replied: MessageRow | null = null;
  if (input.replyToId) {
    replied = maybe(
      await supabaseAdmin
        .from("messages")
        .select("*")
        .eq("id", input.replyToId)
        .eq(targetColumn(target), target.id)
        .maybeSingle(),
    );
    if (!replied) throw apiErrors.badRequest("Сообщение, на которое вы отвечаете, не найдено", "INVALID_REPLY");
  }

  const row = must(
    await supabaseAdmin
      .from("messages")
      .insert({
        chat_id: target.kind === "chat" ? target.id : null,
        channel_id: target.kind === "channel" ? target.id : null,
        user_id: userId,
        type: "text",
        content: input.content,
        reply_to_id: replied?.id ?? null,
      })
      .select("*")
      .single(),
  );

  // Сообщение записано — сразу рассылаем его подписчикам чата (WebSocket), гасим «печатает…»
  stopTypingFor(userId, target);
  const dto = await publishAndRender("new_message", row, userId);

  // Уведомления — без имени автора. Сбой уведомлений не отменяет отправку.
  try {
    if (replied?.user_id && replied.user_id !== userId) {
      await notifyUsers([replied.user_id], "reply", {
        title: "Ответ на ваше сообщение",
        text: `Анонимно: ${input.content.slice(0, 120)}`,
        hrefFor: context.hrefFor,
      });
    }
    if (context.isAnnouncements && context.communityId) {
      const members = must(
        await supabaseAdmin.from("community_members").select("user_id").eq("community_id", context.communityId),
      );
      await notifyUsers(
        members.map((member) => member.user_id).filter((id) => id !== userId),
        "announcement",
        { title: "Новое объявление", text: input.content.slice(0, 160), hrefFor: context.hrefFor },
      );
    }
  } catch (error) {
    console.error("Не удалось создать уведомления:", error);
  }

  return dto;
}

// ── Изменение и удаление ─────────────────────────────────────────────────────

async function getAccessibleMessage(userId: string, messageId: string): Promise<{ message: MessageRow; context: TargetContext }> {
  const message = must(
    await supabaseAdmin.from("messages").select("*").eq("id", messageId).maybeSingle(),
    "Сообщение не найдено",
  );
  const target: MessageTarget = message.chat_id
    ? { kind: "chat", id: message.chat_id }
    : { kind: "channel", id: message.channel_id ?? "" };
  try {
    return { message, context: await resolveTarget(userId, target) };
  } catch {
    throw apiErrors.notFound("Сообщение не найдено"); // нет доступа к чату — сообщения «нет»
  }
}

// Редактировать можно только своё текстовое сообщение
export async function updateMessage(userId: string, messageId: string, content: string): Promise<MessageDto> {
  const { message } = await getAccessibleMessage(userId, messageId);
  if (message.user_id !== userId || message.type !== "text") {
    throw apiErrors.forbidden("Редактировать можно только свои сообщения", "NOT_OWNER");
  }
  const row = must(
    await supabaseAdmin
      .from("messages")
      .update({ content, edited_at: new Date().toISOString() })
      .eq("id", messageId)
      .select("*")
      .single(),
  );
  return publishAndRender("message_updated", row, userId);
}

// Удалить: автор; в сообществе — модератор/админ/владелец; в чате по месту — админ платформы
export async function deleteMessage(userId: string, messageId: string): Promise<void> {
  const { message, context } = await getAccessibleMessage(userId, messageId);
  const isAuthor = message.user_id === userId;
  const isModerator = context.role !== null && MODERATOR_ROLES.includes(context.role);
  if (!isAuthor && !isModerator && !(await isPlatformAdmin(userId))) {
    throw apiErrors.forbidden("Удалять можно только свои сообщения", "NOT_OWNER");
  }
  check(await supabaseAdmin.from("messages").delete().eq("id", messageId));
  publishMessageDeleted(targetOfRow(message), messageId);
}

// Повторное нажатие на свою реакцию снимает её
export async function toggleReaction(userId: string, messageId: string, emoji: string): Promise<MessageDto> {
  const { message } = await getAccessibleMessage(userId, messageId);
  const existing = maybe(
    await supabaseAdmin
      .from("message_reactions")
      .select("emoji")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .maybeSingle(),
  );
  if (existing) {
    check(
      await supabaseAdmin
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("emoji", emoji),
    );
  } else {
    const { error } = await supabaseAdmin.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
    if (error && error.code !== "23505") check({ error });
  }
  // Реакции изменились — у всех подписчиков обновится счётчик (у каждого своё «моя реакция»)
  return publishAndRender("message_updated", message, userId);
}
