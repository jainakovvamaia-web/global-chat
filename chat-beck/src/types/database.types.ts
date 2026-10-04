// Типы таблиц и функций базы Supabase — точно по миграциям supabase/migrations.
// Их можно перегенерировать командой: npx supabase gen types typescript --project-id <id>

type Timestamp = string;

// type, а не interface: supabase-js требует, чтобы строки были совместимы с Record<string, unknown>
type TableDef<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type InstitutionType = "school" | "university";
// Роль пользователя платформы. Хранится только в profiles.role; меняет её только сервер/SQL.
export type UserRole = "user" | "admin";
export type PlatformRole = UserRole;
// Доступ к группе: public — по месту из профиля, private — только участники (chats.is_private)
export type ChatAccessType = "public" | "private";
export type CommunityRole = "owner" | "admin" | "moderator" | "member";
export type CommunityCategory = "school" | "university" | "residential" | "district" | "company";
export type ChatType = "general" | "city" | "district" | "school" | "university" | "local";
export type MessageType = "text" | "system";
export type NotificationType = "mention" | "reply" | "event" | "announcement" | "invite" | "system";
export type RedeemStatus = "joined" | "already_member" | "not_found" | "revoked" | "expired" | "used_up";
export type JoinEventStatus = "joined" | "already_joined" | "full" | "not_found";

export type CityRow = {
  id: string;
  name: string;
  created_at: Timestamp;
};

export type DistrictRow = {
  id: string;
  city_id: string;
  name: string;
  created_at: Timestamp;
};

export type InstitutionRow = {
  district_id: string;
  id: string;
  city_id: string;
  type: InstitutionType;
  name: string;
  full_name: string | null;
  created_at: Timestamp;
};

export type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  username: string | null;
  bio: string;
  avatar_url: string | null;
  city_id: string | null;
  district_id: string | null;
  institution_type: InstitutionType | null;
  institution_id: string | null;
  role: PlatformRole;
  settings: Record<string, unknown>;
  last_seen_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CommunityRow = {
  id: string;
  city_id: string | null;
  name: string;
  category: CommunityCategory;
  description: string;
  emoji: string;
  is_private: boolean;
  created_by: string | null;
  created_at: Timestamp;
};

export type CommunityMemberRow = {
  community_id: string;
  user_id: string;
  role: CommunityRole;
  joined_at: Timestamp;
};

export type JoinRequestRow = {
  community_id: string;
  user_id: string;
  created_at: Timestamp;
};

// Код приглашения: ровно одна цель — сообщество (community_id) или группа (chat_id)
export type InvitationRow = {
  id: string;
  code: string;
  community_id: string | null;
  chat_id: string | null;
  is_active: boolean; // вычисляется базой: revoked_at is null
  created_by: string | null;
  created_at: Timestamp;
  expires_at: Timestamp | null;
  max_uses: number | null;
  uses_count: number;
  revoked_at: Timestamp | null;
};

export type AuditLogRow = {
  id: string;
  community_id: string;
  text: string;
  created_at: Timestamp;
};

export type ChannelRow = {
  id: string;
  community_id: string;
  name: string;
  description: string;
  emoji: string;
  is_announcements: boolean;
  is_pinned: boolean;
  created_at: Timestamp;
};

export type ChannelReadRow = {
  user_id: string;
  channel_id: string;
  last_read_at: Timestamp;
};

export type ChatRow = {
  id: string;
  name: string;
  type: ChatType;
  city_id: string | null;
  district_id: string | null;
  institution_id: string | null;
  community_id: string | null;
  description: string | null;
  emoji: string | null;
  is_private: boolean;
  created_by: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type ChatMemberRow = {
  chat_id: string;
  user_id: string;
  created_at: Timestamp;
};

export type MessageRow = {
  id: string;
  chat_id: string | null;
  channel_id: string | null;
  user_id: string | null;
  type: MessageType;
  content: string;
  reply_to_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  edited_at: Timestamp | null;
};

export type MessageReactionRow = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: Timestamp;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  text: string;
  href: string | null;
  is_read: boolean;
  created_at: Timestamp;
};

export type EventRow = {
  id: string;
  community_id: string;
  title: string;
  description: string;
  emoji: string;
  starts_at: Timestamp;
  location: string;
  max_attendees: number | null;
  organizer_id: string | null;
  created_at: Timestamp;
};

export type EventParticipantRow = {
  event_id: string;
  user_id: string;
  joined_at: Timestamp;
};

// Поля с значениями по умолчанию в Insert необязательны
type WithDefaults<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

export type Database = {
  public: {
    Tables: {
      cities: TableDef<CityRow, WithDefaults<CityRow, "id" | "name">>;
      districts: TableDef<DistrictRow, WithDefaults<DistrictRow, "id" | "city_id" | "name">>;
      institutions: TableDef<
        InstitutionRow,
        WithDefaults<InstitutionRow, "district_id" | "id" | "city_id" | "type" | "name">
      >;
      profiles: TableDef<ProfileRow, WithDefaults<ProfileRow, "id">>;
      communities: TableDef<CommunityRow, WithDefaults<CommunityRow, "name" | "category">>;
      community_members: TableDef<CommunityMemberRow, WithDefaults<CommunityMemberRow, "community_id" | "user_id">>;
      join_requests: TableDef<JoinRequestRow, WithDefaults<JoinRequestRow, "community_id" | "user_id">>;
      invitations: TableDef<InvitationRow, WithDefaults<Omit<InvitationRow, "is_active">, "code">>;
      audit_log: TableDef<AuditLogRow, WithDefaults<AuditLogRow, "community_id" | "text">>;
      channels: TableDef<ChannelRow, WithDefaults<ChannelRow, "community_id" | "name">>;
      channel_reads: TableDef<ChannelReadRow, WithDefaults<ChannelReadRow, "user_id" | "channel_id">>;
      chats: TableDef<ChatRow, WithDefaults<ChatRow, "name" | "type">>;
      chat_members: TableDef<ChatMemberRow, WithDefaults<ChatMemberRow, "chat_id" | "user_id">>;
      messages: TableDef<MessageRow, WithDefaults<MessageRow, "content">>;
      message_reactions: TableDef<
        MessageReactionRow,
        WithDefaults<MessageReactionRow, "message_id" | "user_id" | "emoji">
      >;
      notifications: TableDef<NotificationRow, WithDefaults<NotificationRow, "user_id" | "type" | "title" | "text">>;
      events: TableDef<EventRow, WithDefaults<EventRow, "community_id" | "title" | "starts_at" | "location">>;
      event_participants: TableDef<EventParticipantRow, WithDefaults<EventParticipantRow, "event_id" | "user_id">>;
    };
    Views: Record<never, never>;
    Functions: {
      available_chats: { Args: { p_user: string }; Returns: ChatRow[] };
      can_access_chat: { Args: { p_user: string; p_chat: string }; Returns: boolean };
      can_read_channel: { Args: { p_user: string; p_channel: string }; Returns: boolean };
      join_city_communities: { Args: { p_user: string }; Returns: undefined };
      channel_unread_counts: {
        Args: { p_user: string; p_community: string };
        Returns: { channel_id: string; unread_count: number }[];
      };
      community_weekly_messages: { Args: { p_community: string }; Returns: number };
      community_counts: {
        Args: { p_communities: string[] };
        Returns: { community_id: string; members_count: number; online_count: number }[];
      };
      chat_member_counts: {
        Args: { p_chats: string[] };
        Returns: { chat_id: string; members_count: number; online_count: number }[];
      };
      redeem_invitation: {
        Args: { p_code: string; p_user: string; p_kind?: "chat" | "community" };
        Returns: { community_id: string | null; chat_id: string | null; status: RedeemStatus }[];
      };
      join_event: { Args: { p_event: string; p_user: string }; Returns: JoinEventStatus };
      chat_last_messages: {
        Args: { p_chats: string[] };
        Returns: { chat_id: string; content: string; created_at: Timestamp }[];
      };
      user_stats: {
        Args: { p_user: string };
        Returns: { messages: number; events: number; communities: number }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
