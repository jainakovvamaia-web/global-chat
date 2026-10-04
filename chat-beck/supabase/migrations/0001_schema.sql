-- Global Community Chat — таблицы, связи, ограничения и индексы.
-- Миграция повторяемая: её можно запустить ещё раз — существующие таблицы и данные не удаляются.

-- ── Справочники: город → район → учебное заведение ─────────────────────────

create table if not exists public.cities (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  name        text not null check (char_length(name) between 1 and 100),
  created_at  timestamptz not null default now()
);

create table if not exists public.districts (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  city_id     text not null references public.cities (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  created_at  timestamptz not null default now(),
  -- нужен для составных внешних ключей «район + город» (район точно из этого города)
  unique (id, city_id)
);
create index if not exists districts_city_id_idx on public.districts (city_id);

-- id заведения уникален в пределах района: «school-1» есть и в Первомайском, и в Свердловском
create table if not exists public.institutions (
  district_id text not null,
  id          text not null check (id ~ '^[a-z0-9-]+$'),
  city_id     text not null,
  type        text not null check (type in ('school', 'university')),
  name        text not null check (char_length(name) between 1 and 200),
  full_name   text check (char_length(full_name) <= 300),
  created_at  timestamptz not null default now(),
  primary key (district_id, id),
  -- для внешних ключей «район + заведение + тип»: школа не может числиться университетом
  unique (district_id, id, type),
  foreign key (district_id, city_id) references public.districts (id, city_id) on delete cascade
);
create index if not exists institutions_district_type_idx on public.institutions (district_id, type);

-- ── Профили: связаны с пользователями Supabase Auth ───────────────────────────
-- Пароль здесь НЕ хранится — им полностью управляет Supabase Auth.

create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  first_name       text not null default '' check (char_length(first_name) <= 100),
  last_name        text not null default '' check (char_length(last_name) <= 100),
  email            text not null default '',
  username         text check (char_length(username) <= 64),
  bio              text not null default '' check (char_length(bio) <= 500),
  avatar_url       text,
  city_id          text references public.cities (id) on delete set null,
  district_id      text,
  institution_type text check (institution_type in ('school', 'university')),
  institution_id   text,
  role             text not null default 'user' check (role in ('user', 'admin')),
  settings         jsonb not null default '{}'::jsonb,
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- район из выбранного города, заведение из выбранного района и выбранного типа
  foreign key (district_id, city_id) references public.districts (id, city_id),
  foreign key (district_id, institution_id, institution_type)
    references public.institutions (district_id, id, type),
  check ((institution_id is null) = (institution_type is null)),
  check (district_id is null or city_id is not null)
);
create index if not exists profiles_location_idx on public.profiles (city_id, district_id, institution_id);
-- Имя пользователя уникально без учёта регистра («Ivan» и «ivan» — одно имя)
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username)) where username is not null;

-- ── Сообщества ────────────────────────────────────────────────────────────────

create table if not exists public.communities (
  id          text primary key
              default ('community-' || substr(md5(gen_random_uuid()::text), 1, 8))
              check (id ~ '^[a-z0-9-]+$'),
  city_id     text references public.cities (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 100),
  category    text not null check (category in ('school', 'university', 'residential', 'district', 'company')),
  description text not null default '' check (char_length(description) <= 500),
  emoji       text not null default '🏘️',
  is_private  boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists communities_city_id_idx on public.communities (city_id);

create table if not exists public.community_members (
  community_id text not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'moderator', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user_idx on public.community_members (user_id);

create table if not exists public.join_requests (
  community_id text not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);

-- Код приглашения: ограничен по сроку и числу использований, его можно отозвать
create table if not exists public.invitations (
  code         text primary key check (code ~ '^[A-Z0-9]{6,16}$'),
  community_id text not null references public.communities (id) on delete cascade,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz,               -- null — бессрочный
  max_uses     int check (max_uses is null or max_uses > 0), -- null — без ограничения
  uses_count   int not null default 0 check (uses_count >= 0),
  revoked_at   timestamptz                -- не null — код отозван
);
-- Для баз, созданных до появления этих полей
alter table public.invitations add column if not exists expires_at timestamptz;
alter table public.invitations add column if not exists max_uses int check (max_uses is null or max_uses > 0);
alter table public.invitations add column if not exists uses_count int not null default 0 check (uses_count >= 0);
alter table public.invitations add column if not exists revoked_at timestamptz;
create index if not exists invitations_community_idx on public.invitations (community_id);

-- Журнал действий администраторов и модераторов (без имён — чаты анонимные)
create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  community_id text not null references public.communities (id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 300),
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_community_idx on public.audit_log (community_id, created_at desc);

-- ── Каналы сообщества (#general, #announcements, ...) ───────────────────────

create table if not exists public.channels (
  id               uuid primary key default gen_random_uuid(),
  community_id     text not null references public.communities (id) on delete cascade,
  name             text not null check (name ~ '^[^\s#/]+$' and char_length(name) <= 50 and name <> 'place'),
  description      text not null default '' check (char_length(description) <= 300),
  emoji            text not null default '💬',
  is_announcements boolean not null default false,
  is_pinned        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (community_id, name)
);

-- Когда пользователь последний раз открывал канал — для счётчика непрочитанных
create table if not exists public.channel_reads (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  channel_id   uuid not null references public.channels (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

-- ── Чаты ──────────────────────────────────────────────────────────────────────
-- Кому виден чат, определяют данные строки, а не код:
--   general    — всем
--   city       — жителям city_id
--   district   — жителям district_id
--   school /
--   university — выбравшим заведение (district_id, institution_id)
--   local      — участникам сообщества community_id (раздел «Рядом»)

create table if not exists public.chats (
  id             text primary key default gen_random_uuid()::text check (id ~ '^[a-z0-9-]+$'),
  name           text not null check (char_length(name) between 1 and 100),
  type           text not null check (type in ('general', 'city', 'district', 'school', 'university', 'local')),
  city_id        text references public.cities (id) on delete cascade,
  district_id    text,
  institution_id text,
  community_id   text references public.communities (id) on delete cascade,
  description    text check (char_length(description) <= 300),
  emoji          text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  foreign key (district_id, city_id) references public.districts (id, city_id) on delete cascade,
  -- тип чата должен совпадать с типом заведения (чат школы не привязать к университету)
  foreign key (district_id, institution_id, type)
    references public.institutions (district_id, id, type) on delete cascade,
  -- у каждого типа — ровно свой набор привязок
  constraint chats_scope_check check (
    (type = 'general' and city_id is null and district_id is null and institution_id is null and community_id is null)
    or (type = 'city' and city_id is not null and district_id is null and institution_id is null and community_id is null)
    or (type = 'district' and city_id is not null and district_id is not null and institution_id is null and community_id is null)
    or (type in ('school', 'university') and city_id is not null and district_id is not null
        and institution_id is not null and community_id is null)
    or (type = 'local' and community_id is not null and city_id is null and district_id is null and institution_id is null)
  )
);
create index if not exists chats_scope_idx on public.chats (type, city_id, district_id, institution_id);
create index if not exists chats_community_idx on public.chats (community_id) where community_id is not null;

create table if not exists public.chat_members (
  chat_id    text not null references public.chats (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);
create index if not exists chat_members_user_idx on public.chat_members (user_id);

-- ── Сообщения ─────────────────────────────────────────────────────────────────
-- Сообщение принадлежит ровно одному месту: чату или каналу (ограничение из ТЗ).
-- user_id нужен только серверу (права: удалить своё). Клиентам он не отдаётся — автор всегда «Анонимно».

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     text references public.chats (id) on delete cascade,
  channel_id  uuid references public.channels (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  type        text not null default 'text' check (type in ('text', 'system')),
  content     text not null check (char_length(content) between 1 and 4000),
  reply_to_id uuid references public.messages (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  edited_at   timestamptz,
  constraint messages_one_target check (num_nonnulls(chat_id, channel_id) = 1)
);
-- (created_at, id) — курсор подгрузки истории: сообщения с одинаковым временем не теряются
create index if not exists messages_chat_cursor_idx on public.messages (chat_id, created_at desc, id desc) where chat_id is not null;
create index if not exists messages_channel_cursor_idx on public.messages (channel_id, created_at desc, id desc) where channel_id is not null;
drop index if exists public.messages_chat_idx;
drop index if exists public.messages_channel_idx;
create index if not exists messages_reply_idx on public.messages (reply_to_id) where reply_to_id is not null;
create index if not exists messages_user_idx on public.messages (user_id);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- ── Уведомления ───────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('mention', 'reply', 'event', 'announcement', 'invite', 'system')),
  title      text not null check (char_length(title) between 1 and 200),
  text       text not null check (char_length(text) between 1 and 500),
  href       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ── Мероприятия ───────────────────────────────────────────────────────────────

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  community_id  text not null references public.communities (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 150),
  description   text not null default '' check (char_length(description) <= 2000),
  emoji         text not null default '🎉',
  starts_at     timestamptz not null,
  location      text not null check (char_length(location) between 1 and 200),
  max_attendees int check (max_attendees is null or max_attendees >= 2),
  organizer_id  uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists events_community_idx on public.events (community_id, starts_at);

create table if not exists public.event_participants (
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ── updated_at обновляется автоматически ─────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists messages_set_updated_at on public.messages;
create trigger messages_set_updated_at before update on public.messages
  for each row execute function public.set_updated_at();
