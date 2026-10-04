// Общие типы frontend. Повторяют ответы Express API (chat-beck/src/types/dto.ts).
// Анонимность: в данных других людей нет ни id пользователя, ни имени — только флаги «моё».

export type Id = string;

// Роль пользователя платформы. Приходит с сервера в профиле; frontend по ней только показывает кнопки —
// права всё равно проверяет сервер.
export type UserRole = "user" | "admin";

// Доступ к группе: public — по месту из профиля, private — по приглашению
export type ChatAccessType = "public" | "private";

export type CommunityCategory = "school" | "university" | "residential" | "district" | "company";

export type MemberRole = "owner" | "admin" | "moderator" | "member";

// Участник сообщества — анонимно. id — непрозрачный идентификатор участника в этом сообществе
// (не id пользователя): по нему можно назначить роль, но нельзя узнать человека.
export interface Member {
  id: Id;
  displayName: string; // всегда «Анонимно»
  role: MemberRole;
  isOnline: boolean;
  isSelf: boolean;
  joinedAt: string;
}

export interface Community {
  id: Id;
  cityId: Id | null; // город из справочника — сообщества своего города показываются в «Мои чаты»
  name: string;
  category: CommunityCategory;
  description: string;
  membersCount: number;
  onlineCount: number;
  isPrivate: boolean;
  emoji: string;
  joined: boolean;
  myRole: MemberRole | null;
  requested: boolean; // заявка на вступление уже отправлена
}

export interface Channel {
  id: Id;
  communityId: Id;
  name: string; // используется в адресе страницы: /bishkek/chat/general
  emoji: string;
  description: string;
  isAnnouncements: boolean;
  isPinned: boolean;
  unreadCount: number;
}

// Локальный чат раздела «Рядом» (в базе — chats с type = 'local')
export interface LocalChat {
  id: Id;
  communityId: Id | null;
  name: string;
  description: string | null;
  emoji: string | null;
  membersCount: number;
  onlineCount: number;
  joined: boolean;
  lastMessage: { content: string; createdAt: string } | null; // последнее сообщение — для списка «Рядом»
  access: ChatAccessType;
  canManage: boolean;
}

// Сервер присылает реакции уже посчитанными: сколько всего и поставил ли её текущий пользователь
export interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export type MessageType = "text" | "system";

export interface MessageAuthor {
  displayName: string; // всегда «Анонимно»
}

// Сообщение относится ровно к одному месту: чату (chatId) или каналу (channelId)
export interface Message {
  id: Id;
  chatId: Id | null;
  channelId: Id | null;
  type: MessageType;
  content: string;
  createdAt: string;
  editedAt: string | null;
  replyToId: Id | null;
  replyTo: { id: Id; content: string; author: MessageAuthor } | null;
  author: MessageAuthor;
  isMine: boolean; // сервер сам определяет «моё» по сессии
  reactions: Reaction[];
}

export interface MessagesPage {
  items: Message[];
  nextCursor: string | null;
}

export interface CommunityEvent {
  id: Id;
  communityId: Id;
  title: string;
  description: string;
  emoji: string;
  startsAt: string;
  location: string;
  attendees: number;
  maxAttendees: number | null;
  joined: boolean;
  isOrganizer: boolean;
}

export type NotificationType = "mention" | "reply" | "event" | "announcement" | "invite" | "system";

export interface AppNotification {
  id: Id;
  type: NotificationType;
  title: string;
  text: string; // без имён авторов — чаты анонимные
  createdAt: string;
  isRead: boolean;
  href: string | null;
}

// Код приглашения: действует до expiresAt (null — бессрочно) и maxUses раз (null — без лимита).
// Цель — сообщество (communityId) или группа (chatId)
export interface Invitation {
  id: Id;
  code: string;
  communityId: Id | null;
  chatId: Id | null;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean;
}

// Запись журнала действий администраторов и модераторов
export interface AuditEntry {
  id: Id;
  communityId: Id;
  text: string;
  createdAt: string;
}

export interface CommunityStats {
  membersCount: number;
  onlineCount: number;
  channelsCount: number;
  weeklyMessages: number;
}

// ── Места и учёба (справочники) ──────────────────────────────

export interface City {
  id: Id;
  name: string;
}

export interface District {
  id: Id;
  cityId: Id;
  name: string;
}

export type InstitutionType = "school" | "university";

export interface Institution {
  id: Id; // уникален в пределах района: "knu", "school-61"
  type: InstitutionType;
  cityId: Id;
  name: string;
  fullName: string | null;
  districtId: Id;
}

// Выбор пользователя в форме. Пустая строка — «не выбрано» (так удобнее для <select>)
export interface LocationSelection {
  cityId: Id | "";
  districtId: Id | "";
  institutionType: InstitutionType | "";
  institutionId: Id | "";
}

// Чат по месту. Кому он виден, решает сервер по данным чата и профилю пользователя.
export type PlaceChatType = "general" | "city" | "district" | "school" | "university";

export interface PlaceChat {
  id: Id;
  name: string;
  type: PlaceChatType;
  cityId: Id | null;
  districtId: Id | null;
  institutionId: Id | null;
  description: string | null;
  emoji: string | null;
  communityId: Id | null; // у чатов по месту всегда null
  access: ChatAccessType;
  canManage: boolean; // я создатель группы или admin — можно приглашать и удалять
}

// Тип группы при создании: чаты по месту + локальный чат «Рядом» текущего сообщества
export type ChatType = PlaceChatType | "local";

// Группа любого типа — так её возвращает сервер после создания (POST /api/chats)
export type GroupChat = Omit<PlaceChat, "type"> & { type: ChatType };

// Ответ на вход по коду: группа или сообщество и адрес, куда перейти
export type JoinByInvitationResult =
  | { message: string; kind: "chat"; chat: PlaceChat; href: string }
  | { message: string; kind: "community"; community: Community; href: string };

// Личные данные владельца. Приходят только ему самому (GET /api/auth/me)
export interface Profile {
  id: Id;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  bio: string;
  avatarUrl: string | null;
  role: UserRole;
  joinedAt: string;
  location: LocationSelection;
  locationNames: { city: string | null; district: string | null; institution: string | null };
  isProfileComplete: boolean; // у вошедшего через Google город ещё не выбран
  hasPassword: boolean; // false — аккаунт создан через Google, пароль ещё не задан
}

export type NotificationSettingKey = "messages" | "mentions" | "replies" | "announcements" | "events";
export type Theme = "light" | "dark" | "system";

export interface UserSettings {
  notifications: Record<NotificationSettingKey, boolean>;
  privacy: Record<"whoCanMessage" | "whoSeesOnline", string>;
  theme: Theme;
}

export interface SearchResult {
  communities: Community[];
  chats: PlaceChat[];
  messages: { id: Id; content: string; createdAt: string; author: MessageAuthor; isMine: boolean; placeName: string; href: string }[];
}
