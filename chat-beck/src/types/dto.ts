// Формы данных, которые API отдаёт frontend (camelCase).
// Правило анонимности: ни в одном DTO чужого пользователя нет user_id, имени, email или username.
// Про «своё» сервер сообщает флагами isMine / isSelf.

import type {
  ChatAccessType,
  ChatType,
  CommunityCategory,
  CommunityRole,
  InstitutionType,
  MessageType,
  NotificationType,
  PlatformRole,
} from "./database.types";

export interface CityDto {
  id: string;
  name: string;
}

export interface DistrictDto {
  id: string;
  cityId: string;
  name: string;
}

export interface InstitutionDto {
  id: string;
  type: InstitutionType;
  cityId: string;
  districtId: string;
  name: string;
  fullName: string | null;
}

export interface LocationDto {
  cityId: string | null;
  districtId: string | null;
  institutionType: InstitutionType | null;
  institutionId: string | null;
}

// Личный профиль — отдаётся ТОЛЬКО владельцу (GET /api/auth/me)
export interface ProfileDto {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  bio: string;
  avatarUrl: string | null;
  role: PlatformRole;
  joinedAt: string;
  location: LocationDto;
  locationNames: { city: string | null; district: string | null; institution: string | null };
  isProfileComplete: boolean; // у Google-пользователя город ещё не выбран
  hasPassword: boolean; // false — аккаунт создан через Google, пароль ещё не задан
}

// Своя статистика для страницы профиля
export interface MyStatsDto {
  messages: number;
  events: number;
  communities: number;
}

export type SettingsDto = {
  notifications: Record<"messages" | "mentions" | "replies" | "announcements" | "events", boolean>;
  privacy: Record<"whoCanMessage" | "whoSeesOnline", string>;
  theme: "light" | "dark" | "system";
};

export interface SessionDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface CommunityDto {
  id: string;
  cityId: string | null;
  name: string;
  category: CommunityCategory;
  description: string;
  emoji: string;
  isPrivate: boolean;
  membersCount: number;
  onlineCount: number;
  joined: boolean;
  myRole: CommunityRole | null;
  requested: boolean; // заявка на вступление уже отправлена
}

// Участник сообщества — анонимно: вместо user_id выдаётся непрозрачный memberId
export interface MemberDto {
  memberId: string;
  displayName: string;
  role: CommunityRole;
  isOnline: boolean;
  isSelf: boolean;
  joinedAt: string;
}

export interface ChannelDto {
  id: string;
  communityId: string;
  name: string;
  description: string;
  emoji: string;
  isAnnouncements: boolean;
  isPinned: boolean;
  unreadCount: number;
}

export interface ChatDto {
  id: string;
  name: string;
  type: ChatType;
  cityId: string | null;
  districtId: string | null;
  institutionId: string | null;
  communityId: string | null;
  description: string | null;
  emoji: string | null;
  access: ChatAccessType; // private — только участники по приглашению
  canManage: boolean; // текущий пользователь — создатель группы или admin платформы
}

// Локальный чат «Рядом» с числом участников
export interface LocalChatDto extends ChatDto {
  membersCount: number;
  onlineCount: number;
  joined: boolean;
  lastMessage: { content: string; createdAt: string } | null; // для списка «Рядом»
}

// Код приглашения — видят только те, кто может приглашать (admin / создатель / менеджер сообщества)
export interface InvitationDto {
  id: string;
  code: string;
  communityId: string | null;
  chatId: string | null;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean; // не отозван, не истёк и не исчерпан
}

export interface AuthorDto {
  displayName: string; // всегда «Анонимно»
}

export interface ReactionDto {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface MessageDto {
  id: string;
  chatId: string | null;
  channelId: string | null;
  type: MessageType;
  content: string;
  createdAt: string;
  editedAt: string | null;
  replyToId: string | null;
  replyTo: { id: string; content: string; author: AuthorDto } | null;
  author: AuthorDto;
  isMine: boolean;
  reactions: ReactionDto[];
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  text: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface EventDto {
  id: string;
  communityId: string;
  title: string;
  description: string;
  emoji: string;
  startsAt: string;
  location: string;
  maxAttendees: number | null;
  attendees: number;
  joined: boolean;
  isOrganizer: boolean;
}

export interface AuditEntryDto {
  id: string;
  communityId: string;
  text: string;
  createdAt: string;
}

export interface CommunityStatsDto {
  membersCount: number;
  onlineCount: number;
  channelsCount: number;
  weeklyMessages: number;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

// Результат входа по коду приглашения: группа или сообщество и куда перейти
export type JoinByInvitationDto =
  | { message: string; kind: "chat"; chat: ChatDto; href: string }
  | { message: string; kind: "community"; community: CommunityDto; href: string };
