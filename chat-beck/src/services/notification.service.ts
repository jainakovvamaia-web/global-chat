// Уведомления. Новое уведомление триггер в базе отправляет сигналом Realtime в тему user:<id>.

import { supabaseAdmin } from "../config/supabase";
import type { NotificationRow, NotificationType } from "../types/database.types";
import type { NotificationDto, SettingsDto } from "../types/dto";
import { check, countOf, must } from "../utils/db";
import { readSettings } from "./user.service";
import { signalNotification } from "../realtime/realtime.service";

const toNotificationDto = (row: NotificationRow): NotificationDto => ({
  id: row.id,
  type: row.type,
  title: row.title,
  text: row.text,
  href: row.href,
  isRead: row.is_read,
  createdAt: row.created_at,
});

// Какая настройка пользователя разрешает тип уведомления
const SETTING_FOR_TYPE: Partial<Record<NotificationType, keyof SettingsDto["notifications"]>> = {
  reply: "replies",
  mention: "mentions",
  announcement: "announcements",
  event: "events",
};

// Создать уведомления нескольким пользователям с учётом их настроек
export async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  content: { title: string; text: string; hrefFor: (recipientId: string) => Promise<string | null> },
): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  const settingKey = SETTING_FOR_TYPE[type];
  let recipients = unique;
  if (settingKey) {
    const profiles = must(await supabaseAdmin.from("profiles").select("id, settings").in("id", unique));
    recipients = profiles.filter((profile) => readSettings(profile.settings).notifications[settingKey]).map((p) => p.id);
  }
  if (recipients.length === 0) return;

  const rows = await Promise.all(
    recipients.map(async (userId) => ({
      user_id: userId,
      type,
      title: content.title.slice(0, 200),
      text: content.text.slice(0, 500) || "—",
      href: await content.hrefFor(userId),
    })),
  );
  check(await supabaseAdmin.from("notifications").insert(rows));
  signalNotification(recipients); // открытые вкладки сразу обновят список уведомлений
}

export async function listNotifications(userId: string): Promise<{ items: NotificationDto[]; unreadCount: number }> {
  const [rows, unread] = await Promise.all([
    supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
  ]);
  return { items: must(rows).map(toNotificationDto), unreadCount: countOf(unread) };
}

// Условие user_id = мой — чужое уведомление отметить нельзя
export async function markRead(userId: string, notificationId: string): Promise<void> {
  check(await supabaseAdmin.from("notifications").update({ is_read: true }).eq("id", notificationId).eq("user_id", userId));
}

export async function markAllRead(userId: string): Promise<void> {
  check(await supabaseAdmin.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false));
}
