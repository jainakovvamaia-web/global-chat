// Вспомогательные функции для отображения участников: инициалы, цвет аватара, подпись роли

import type { MemberRole } from "@/types";

// Цвета аватаров из макета (Tailwind: indigo, blue, emerald, purple, pink, amber, teal, rose — оттенок 500)
const AVATAR_COLORS = [
  "oklch(58.5% 0.233 277.117)",
  "oklch(62.3% 0.214 259.815)",
  "oklch(69.6% 0.17 162.48)",
  "oklch(62.7% 0.265 303.9)",
  "oklch(65.6% 0.241 354.308)",
  "oklch(76.9% 0.188 70.08)",
  "oklch(70.4% 0.14 182.503)",
  "oklch(64.5% 0.246 16.439)",
];

// Цвет зависит только от имени, поэтому у одного человека он всегда одинаковый
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// «Алина Петрова» → «АП»
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Владелец",
  admin: "Администратор",
  moderator: "Модератор",
  member: "Участник",
};
