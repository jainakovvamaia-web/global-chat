// Подписи и иконки категорий сообществ (ТЗ, п. 5.2)

import type { CommunityCategory } from "@/types";

export const CATEGORY_LABELS: Record<CommunityCategory, string> = {
  school: "Школы",
  university: "Университеты",
  residential: "Жилые комплексы",
  district: "Районы",
  company: "Компании",
};

export const CATEGORY_EMOJIS: Record<CommunityCategory, string> = {
  school: "🏫",
  university: "🎓",
  residential: "🏠",
  district: "🏙️",
  company: "💼",
};
