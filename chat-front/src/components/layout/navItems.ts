// Разделы приложения внутри сообщества — общий список для боковой панели и мобильной навигации

import {
  Bell,
  Calendar,
  CircleUser,
  Lightbulb,
  MapPin,
  MessageCircleMore,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type SectionKey =
  | "chat"
  | "nearby"
  | "events"
  | "members"
  | "notifications"
  | "ai"
  | "admin"
  | "settings"
  | "profile";

export interface NavItem {
  key: SectionKey;
  label: string;
  shortLabel: string; // подпись в мобильной навигации
  icon: LucideIcon;
}

export const NAV_ITEMS: Record<SectionKey, NavItem> = {
  chat: { key: "chat", label: "Чат", shortLabel: "Чат", icon: MessageCircleMore },
  nearby: { key: "nearby", label: "Рядом", shortLabel: "Рядом", icon: MapPin },
  events: { key: "events", label: "События", shortLabel: "События", icon: Calendar },
  members: { key: "members", label: "Участники", shortLabel: "Участники", icon: Users },
  notifications: { key: "notifications", label: "Уведомления", shortLabel: "Уведомления", icon: Bell },
  ai: { key: "ai", label: "AI-помощник", shortLabel: "AI", icon: Lightbulb },
  admin: { key: "admin", label: "Панель администратора", shortLabel: "Админ", icon: ShieldCheck },
  settings: { key: "settings", label: "Настройки", shortLabel: "Настройки", icon: Settings },
  profile: { key: "profile", label: "Профиль", shortLabel: "Профиль", icon: CircleUser },
};

export const sectionHref = (communityId: string, key: SectionKey) => `/${communityId}/${key}`;

// Первый сегмент пути после id сообщества: /bishkek/chat/general → "chat"
export function getActiveSection(pathname: string): SectionKey | null {
  const section = pathname.split("/")[2];
  return section && section in NAV_ITEMS ? (section as SectionKey) : null;
}
