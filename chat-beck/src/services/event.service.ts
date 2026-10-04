// Мероприятия сообщества. Организатор не раскрывается — только флаг isOrganizer для него самого.

import { supabaseAdmin } from "../config/supabase";
import type { EventRow } from "../types/database.types";
import type { EventDto } from "../types/dto";
import { apiErrors } from "../utils/apiErrors";
import { check, must } from "../utils/db";
import type { EventInput } from "../validators/community.validators";
import { MANAGER_ROLES, requireMember } from "./access.service";
import { addAudit } from "./audit.service";
import { notifyUsers } from "./notification.service";

async function toEventDtos(userId: string, rows: EventRow[]): Promise<EventDto[]> {
  if (rows.length === 0) return [];
  const participants = must(
    await supabaseAdmin
      .from("event_participants")
      .select("event_id, user_id")
      .in("event_id", rows.map((row) => row.id)),
  );
  return rows.map((row) => {
    const people = participants.filter((item) => item.event_id === row.id);
    return {
      id: row.id,
      communityId: row.community_id,
      title: row.title,
      description: row.description,
      emoji: row.emoji,
      startsAt: row.starts_at,
      location: row.location,
      maxAttendees: row.max_attendees,
      attendees: people.length,
      joined: people.some((item) => item.user_id === userId),
      isOrganizer: row.organizer_id === userId,
    };
  });
}

export async function listEvents(userId: string, communityId: string): Promise<EventDto[]> {
  await requireMember(userId, communityId);
  const rows = must(
    await supabaseAdmin.from("events").select("*").eq("community_id", communityId).order("starts_at"),
  );
  return toEventDtos(userId, rows);
}

async function getAccessibleEvent(userId: string, eventId: string): Promise<EventRow> {
  const row = must(await supabaseAdmin.from("events").select("*").eq("id", eventId).maybeSingle(), "Событие не найдено");
  try {
    await requireMember(userId, row.community_id);
  } catch {
    throw apiErrors.notFound("Событие не найдено");
  }
  return row;
}

export async function getEvent(userId: string, eventId: string): Promise<EventDto> {
  const [dto] = await toEventDtos(userId, [await getAccessibleEvent(userId, eventId)]);
  if (!dto) throw apiErrors.notFound("Событие не найдено");
  return dto;
}

export async function createEvent(userId: string, communityId: string, input: EventInput): Promise<EventDto> {
  const { community } = await requireMember(userId, communityId);
  if (new Date(input.startsAt).getTime() < Date.now() - 60_000) {
    throw apiErrors.badRequest("Дата события уже прошла", "PAST_DATE");
  }
  const row = must(
    await supabaseAdmin
      .from("events")
      .insert({
        community_id: communityId,
        title: input.title,
        description: input.description,
        emoji: input.emoji,
        starts_at: input.startsAt,
        location: input.location,
        max_attendees: input.maxAttendees,
        organizer_id: userId,
      })
      .select("*")
      .single(),
  );
  check(await supabaseAdmin.from("event_participants").insert({ event_id: row.id, user_id: userId }));
  await addAudit(communityId, `Создано событие «${row.title}»`);

  try {
    const members = must(await supabaseAdmin.from("community_members").select("user_id").eq("community_id", communityId));
    await notifyUsers(
      members.map((member) => member.user_id).filter((id) => id !== userId),
      "event",
      { title: `Новое событие в «${community.name}»`, text: row.title, hrefFor: async () => `/${communityId}/events/${row.id}` },
    );
  } catch (error) {
    console.error("Не удалось уведомить о событии:", error);
  }
  return getEvent(userId, row.id);
}

// Удалить событие может организатор или администратор сообщества
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const row = await getAccessibleEvent(userId, eventId);
  const { role } = await requireMember(userId, row.community_id);
  if (row.organizer_id !== userId && !MANAGER_ROLES.includes(role)) {
    throw apiErrors.forbidden("Удалить событие может организатор или администратор", "FORBIDDEN_ROLE");
  }
  check(await supabaseAdmin.from("events").delete().eq("id", eventId));
  await addAudit(row.community_id, `Удалено событие «${row.title}»`);
}

// Запись проверяет лимит мест и добавляет участника одной транзакцией в базе (join_event):
// двое одновременно не займут последнее место
export async function joinEvent(userId: string, eventId: string): Promise<EventDto> {
  await getAccessibleEvent(userId, eventId);
  const status = must(await supabaseAdmin.rpc("join_event", { p_event: eventId, p_user: userId }));
  if (status === "full") throw apiErrors.conflict("Свободных мест нет", "EVENT_FULL");
  if (status === "not_found") throw apiErrors.notFound("Событие не найдено");
  return getEvent(userId, eventId);
}

export async function leaveEvent(userId: string, eventId: string): Promise<EventDto> {
  await getAccessibleEvent(userId, eventId);
  check(await supabaseAdmin.from("event_participants").delete().eq("event_id", eventId).eq("user_id", userId));
  return getEvent(userId, eventId);
}
