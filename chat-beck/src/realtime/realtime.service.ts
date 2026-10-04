// Точка входа realtime для сервисов REST API. Все функции «безопасные»: сбой доставки
// события никогда не отменяет уже выполненную запись в базу и не ломает HTTP-ответ.

import type { MessageDto } from "../types/dto";
import { hasTargetAccess } from "../services/access.service";
import { RealtimeHub } from "./realtime.hub";
import type { RealtimeTarget } from "./realtime.types";

// Функция-обёртка, а не прямая ссылка: модули сервисов импортируют друг друга, и к моменту
// первой проверки доступа hasTargetAccess уже точно загружен
export const realtimeHub = new RealtimeHub((userId, target) => hasTargetAccess(userId, target));

function safely(action: () => void): void {
  try {
    action();
  } catch (error) {
    console.error("Realtime: не удалось разослать событие", error);
  }
}

// Новое или изменённое сообщение — подписчикам места. buildFor(userId) собирает DTO для
// конкретного получателя (isMine, reactedByMe); автор всегда «Анонимно».
export function publishMessage(
  type: "new_message" | "message_updated",
  target: RealtimeTarget,
  buildFor: (userId: string) => MessageDto,
): void {
  safely(() => realtimeHub.publish(target, (userId) => ({ type, target, message: buildFor(userId) })));
}

export function publishMessageDeleted(target: RealtimeTarget, messageId: string): void {
  safely(() => realtimeHub.publish(target, () => ({ type: "message_deleted", target, messageId })));
}

// Автор отправил сообщение — его индикатор «печатает» гаснет у остальных
export function stopTypingFor(userId: string, target: RealtimeTarget): void {
  safely(() => realtimeHub.stopTyping(userId, target));
}

// Новое уведомление — сигнал вкладкам пользователя (содержимое они загрузят через REST)
export function signalNotification(userIds: string[]): void {
  safely(() => {
    for (const userId of new Set(userIds)) realtimeHub.sendToUser(userId, { type: "notification_created" });
  });
}

// Доступ пользователя мог измениться (вышел из группы, сменил район, удалён из сообщества)
export function revalidateAccess(userId: string): void {
  realtimeHub.revalidate(userId).catch((error: unknown) => console.error("Realtime: ошибка перепроверки", error));
}

// Изменились правила доступа к группе (открытая ↔ закрытая) — перепроверяем все подписки
export function revalidateAllAccess(): void {
  realtimeHub.revalidate().catch((error: unknown) => console.error("Realtime: ошибка перепроверки", error));
}

// Чат или канал удалён
export function closeTopic(target: RealtimeTarget): void {
  safely(() => realtimeHub.closeTopic(target));
}
