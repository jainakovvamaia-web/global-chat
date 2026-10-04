import type { CommunityEvent } from "@/types";

// Состояние кнопки записи: уже участвую / можно записаться / мест нет
export function getJoinState(event: CommunityEvent): "joined" | "open" | "full" {
  if (event.joined) return "joined";
  const isFull = event.maxAttendees !== null && event.attendees >= event.maxAttendees;
  return isFull ? "full" : "open";
}
