-- Global Community Chat — функции доступа, триггеры профиля и Realtime.
-- Все функции пересоздаются через create or replace — миграцию можно запускать повторно.

-- ── Доступ к чатам: ЕДИНСТВЕННОЕ место с правилами «кому виден чат» ─────────
-- Используется и Express (через available_chats / can_access_chat), и политикой Realtime.
-- Новый чат, добавленный в таблицу chats, сразу становится доступен нужным людям.

create or replace function public.can_access_chat(p_user uuid, p_chat text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chats c
    join public.profiles p on p.id = p_user
    where c.id = p_chat
      and (
        c.type = 'general'
        or (c.type = 'city' and c.city_id = p.city_id)
        or (c.type = 'district' and c.city_id = p.city_id and c.district_id = p.district_id)
        or (c.type in ('school', 'university')
            and c.city_id = p.city_id
            and c.district_id = p.district_id
            and c.institution_id = p.institution_id
            and c.type = p.institution_type)
        or (c.type = 'local' and exists (
              select 1 from public.community_members m
              where m.community_id = c.community_id and m.user_id = p_user))
      )
  );
$$;

-- Чаты по месту, доступные пользователю (локальные чаты «Рядом» отдаются отдельно, по сообществу)
create or replace function public.available_chats(p_user uuid)
returns setof public.chats
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.chats c
  where c.type <> 'local' and public.can_access_chat(p_user, c.id)
  order by
    case c.type when 'general' then 0 when 'city' then 1 when 'district' then 2 else 3 end,
    c.created_at,
    c.name;
$$;

-- Каналы сообщества читают его участники
create or replace function public.can_read_channel(p_user uuid, p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.channels ch
    join public.community_members m on m.community_id = ch.community_id and m.user_id = p_user
    where ch.id = p_channel
  );
$$;

-- ── Вступление в сообщества своего города ───────────────────────────────────
-- Житель города автоматически становится участником открытых сообществ этого города.

create or replace function public.join_city_communities(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.community_members (community_id, user_id, role)
  select c.id, p.id, 'member'
  from public.profiles p
  join public.communities c on c.city_id = p.city_id and not c.is_private
  where p.id = p_user
  on conflict (community_id, user_id) do nothing;
$$;

-- ── Профиль создаётся автоматически при регистрации (email или Google) ─────
-- Данные берутся из user_metadata, которые Express передаёт в supabase.auth.signUp.
-- У Google-пользователя города нет — его он выберет на странице заполнения профиля.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := coalesce(meta ->> 'full_name', meta ->> 'name', '');
  -- Имя пользователя из email: только латиница, цифры, «_» и «.»; при совпадении — с суффиксом
  base_username text := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_.]', '', 'g'), 24);
  new_username text;
begin
  if length(base_username) < 3 then
    base_username := 'user';
  end if;
  new_username := base_username;
  while exists (select 1 from public.profiles where lower(username) = new_username) loop
    new_username := base_username || '_' || substr(md5(random()::text), 1, 5);
  end loop;

  insert into public.profiles (
    id, email, first_name, last_name, username, avatar_url,
    city_id, district_id, institution_type, institution_id
  )
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(meta ->> 'first_name', ''), split_part(full_name, ' ', 1)), 100),
    left(coalesce(nullif(meta ->> 'last_name', ''), nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''), ''), 100),
    new_username,
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), ''),
    nullif(meta ->> 'city_id', ''),
    nullif(meta ->> 'district_id', ''),
    nullif(meta ->> 'institution_type', ''),
    nullif(meta ->> 'institution_id', '')
  )
  on conflict (id) do nothing;

  perform public.join_city_communities(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Realtime: сигнал «в чате что-то изменилось» ─────────────────────────────
-- В сигнале НЕТ текста и автора — только id. Клиент по сигналу перезапрашивает
-- сообщения через Express, который отдаёт автора как «Анонимно».
-- Каналы Realtime приватные: слушать может только тот, у кого есть доступ (политика в 0003).

create or replace function public.message_topic(p_chat text, p_channel uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_chat is not null then 'chat:' || p_chat else 'channel:' || p_channel::text end;
$$;

create or replace function public.broadcast_message_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.messages := coalesce(new, old);
begin
  perform realtime.send(
    jsonb_build_object('action', lower(tg_op), 'messageId', row_data.id),
    'change',
    public.message_topic(row_data.chat_id, row_data.channel_id),
    true
  );
  return null;
end;
$$;

drop trigger if exists messages_broadcast on public.messages;
create trigger messages_broadcast
  after insert or update or delete on public.messages
  for each row execute function public.broadcast_message_change();

create or replace function public.broadcast_reaction_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg public.messages;
begin
  select * into msg from public.messages where id = coalesce(new.message_id, old.message_id);
  if found then
    perform realtime.send(
      jsonb_build_object('action', 'reaction', 'messageId', msg.id),
      'change',
      public.message_topic(msg.chat_id, msg.channel_id),
      true
    );
  end if;
  return null;
end;
$$;

drop trigger if exists message_reactions_broadcast on public.message_reactions;
create trigger message_reactions_broadcast
  after insert or delete on public.message_reactions
  for each row execute function public.broadcast_reaction_change();

-- Новое уведомление — сигнал в личный канал пользователя user:<id>
create or replace function public.broadcast_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('action', 'insert', 'notificationId', new.id),
    'change',
    'user:' || new.user_id::text,
    true
  );
  return null;
end;
$$;

drop trigger if exists notifications_broadcast on public.notifications;
create trigger notifications_broadcast
  after insert on public.notifications
  for each row execute function public.broadcast_notification();

-- Кто может слушать тему Realtime. Ошибочный формат темы — просто «нет доступа».
create or replace function public.can_receive_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null or p_topic is null then
    return false;
  end if;
  if p_topic like 'chat:%' then
    return public.can_access_chat(viewer, substr(p_topic, 6));
  end if;
  if p_topic ~ '^channel:[0-9a-f-]{36}$' then
    return public.can_read_channel(viewer, substr(p_topic, 9)::uuid);
  end if;
  return p_topic = 'user:' || viewer::text;
end;
$$;

-- ── Статистика ───────────────────────────────────────────────────────────────

-- Непрочитанные сообщения в каналах сообщества для пользователя
create or replace function public.channel_unread_counts(p_user uuid, p_community text)
returns table (channel_id uuid, unread_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select ch.id, count(m.id)::int
  from public.channels ch
  left join public.channel_reads r on r.channel_id = ch.id and r.user_id = p_user
  left join public.messages m
    on m.channel_id = ch.id
   and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
   and m.user_id is distinct from p_user
  where ch.community_id = p_community
  group by ch.id;
$$;

-- Сообщений в каналах и локальных чатах сообщества за 7 дней
create or replace function public.community_weekly_messages(p_community text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.messages m
  left join public.channels ch on ch.id = m.channel_id
  left join public.chats c on c.id = m.chat_id
  where m.created_at > now() - interval '7 days'
    and (ch.community_id = p_community or c.community_id = p_community);
$$;

-- «Онлайн» = заходил в последние 5 минут И разрешил показывать статус (настройка приватности «Все»)
create or replace function public.is_visible_online(p_last_seen timestamptz, p_settings jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_last_seen > now() - interval '5 minutes', false)
     and coalesce(p_settings #>> '{privacy,whoSeesOnline}', 'Все') = 'Все';
$$;

-- Участники и «онлайн» для списка сообществ
create or replace function public.community_counts(p_communities text[])
returns table (community_id text, members_count int, online_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select m.community_id,
         count(*)::int,
         (count(*) filter (where public.is_visible_online(p.last_seen_at, p.settings)))::int
  from public.community_members m
  join public.profiles p on p.id = m.user_id
  where m.community_id = any (p_communities)
  group by m.community_id;
$$;

-- То же для локальных чатов «Рядом» (участники — те, кто нажал «Присоединиться»)
create or replace function public.chat_member_counts(p_chats text[])
returns table (chat_id text, members_count int, online_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select cm.chat_id,
         count(*)::int,
         (count(*) filter (where public.is_visible_online(p.last_seen_at, p.settings)))::int
  from public.chat_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.chat_id = any (p_chats)
  group by cm.chat_id;
$$;

-- ── Автоматические чаты по месту ────────────────────────────────────────────
-- Новый город, район или учебное заведение в справочнике сразу получает свой общий чат.
-- id чатов совпадают с начальными данными: «<город>-city», «<район>-general», «<район>-<заведение>-general».

create or replace function public.create_place_chat_for_city()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.chats where type = 'city' and city_id = new.id) then
    insert into public.chats (id, name, type, city_id, description)
    values (new.id || '-city', left(new.name, 100), 'city', new.id, left('Общий чат жителей города ' || new.name, 300))
    on conflict (id) do nothing;
  end if;
  return null;
end;
$$;

create or replace function public.create_place_chat_for_district()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.chats where type = 'district' and district_id = new.id) then
    insert into public.chats (id, name, type, city_id, district_id)
    values (new.id || '-general', left('Общий чат — ' || new.name, 100), 'district', new.city_id, new.id)
    on conflict (id) do nothing;
  end if;
  return null;
end;
$$;

create or replace function public.create_place_chat_for_institution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.chats
    where type = new.type and district_id = new.district_id and institution_id = new.id
  ) then
    insert into public.chats (id, name, type, city_id, district_id, institution_id, description)
    values (
      new.district_id || '-' || new.id || '-general',
      left('Общий чат — ' || new.name, 100),
      new.type, new.city_id, new.district_id, new.id,
      left(new.full_name, 300)
    )
    on conflict (id) do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists cities_create_chat on public.cities;
create trigger cities_create_chat after insert on public.cities
  for each row execute function public.create_place_chat_for_city();

drop trigger if exists districts_create_chat on public.districts;
create trigger districts_create_chat after insert on public.districts
  for each row execute function public.create_place_chat_for_district();

drop trigger if exists institutions_create_chat on public.institutions;
create trigger institutions_create_chat after insert on public.institutions
  for each row execute function public.create_place_chat_for_institution();

-- Общий чат всего приложения
insert into public.chats (id, name, type, description)
values ('global-community', 'Global Community', 'general', 'Общий чат всех пользователей приложения')
on conflict (id) do nothing;

-- Справочник, заполненный раньше, чем появились триггеры: досоздаём недостающие чаты
insert into public.chats (id, name, type, city_id, description)
select c.id || '-city', left(c.name, 100), 'city', c.id, left('Общий чат жителей города ' || c.name, 300)
from public.cities c
where not exists (select 1 from public.chats x where x.type = 'city' and x.city_id = c.id)
on conflict (id) do nothing;

insert into public.chats (id, name, type, city_id, district_id)
select d.id || '-general', left('Общий чат — ' || d.name, 100), 'district', d.city_id, d.id
from public.districts d
where not exists (select 1 from public.chats x where x.type = 'district' and x.district_id = d.id)
on conflict (id) do nothing;

insert into public.chats (id, name, type, city_id, district_id, institution_id, description)
select i.district_id || '-' || i.id || '-general', left('Общий чат — ' || i.name, 100), i.type,
       i.city_id, i.district_id, i.id, left(i.full_name, 300)
from public.institutions i
where not exists (
  select 1 from public.chats x where x.type = i.type and x.district_id = i.district_id and x.institution_id = i.id
)
on conflict (id) do nothing;

-- ── Смена email в Supabase Auth → email в профиле ───────────────────────────
-- Email меняется только после подтверждения письма; тогда же обновляется профиль.

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return null;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- ── Приглашения: использование кода ──────────────────────────────────────────
-- Всё в одной транзакции и с блокировкой строки кода: лимит использований нельзя превысить
-- одновременными запросами. Статус: joined | already_member | not_found | revoked | expired | used_up.

create or replace function public.redeem_invitation(p_code text, p_user uuid)
returns table (community_id text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  inserted int;
begin
  select * into inv from public.invitations i where i.code = p_code for update;
  if not found then
    return query select null::text, 'not_found'::text;
    return;
  end if;
  if exists (select 1 from public.community_members m where m.community_id = inv.community_id and m.user_id = p_user) then
    return query select inv.community_id, 'already_member'::text;
    return;
  end if;
  if inv.revoked_at is not null then
    return query select inv.community_id, 'revoked'::text;
    return;
  end if;
  if inv.expires_at is not null and inv.expires_at <= now() then
    return query select inv.community_id, 'expired'::text;
    return;
  end if;
  if inv.max_uses is not null and inv.uses_count >= inv.max_uses then
    return query select inv.community_id, 'used_up'::text;
    return;
  end if;

  insert into public.community_members (community_id, user_id, role)
  values (inv.community_id, p_user, 'member')
  on conflict do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.invitations set uses_count = uses_count + 1 where code = inv.code;
    delete from public.join_requests j where j.community_id = inv.community_id and j.user_id = p_user;
    return query select inv.community_id, 'joined'::text;
  else
    return query select inv.community_id, 'already_member'::text;
  end if;
end;
$$;

-- ── Запись на мероприятие ────────────────────────────────────────────────────
-- Блокировка строки события: два человека не займут одно последнее место.
-- Статус: joined | already_joined | full | not_found.

create or replace function public.join_event(p_event uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.events;
  taken int;
begin
  select * into ev from public.events where id = p_event for update;
  if not found then
    return 'not_found';
  end if;
  if exists (select 1 from public.event_participants where event_id = p_event and user_id = p_user) then
    return 'already_joined';
  end if;
  if ev.max_attendees is not null then
    select count(*) into taken from public.event_participants where event_id = p_event;
    if taken >= ev.max_attendees then
      return 'full';
    end if;
  end if;
  insert into public.event_participants (event_id, user_id) values (p_event, p_user);
  return 'joined';
end;
$$;

-- ── Последние сообщения локальных чатов (список «Рядом») ─────────────────────

create or replace function public.chat_last_messages(p_chats text[])
returns table (chat_id text, content text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (m.chat_id) m.chat_id, m.content, m.created_at
  from public.messages m
  where m.chat_id = any (p_chats)
  order by m.chat_id, m.created_at desc, m.id desc;
$$;

-- ── Статистика профиля ───────────────────────────────────────────────────────

create or replace function public.user_stats(p_user uuid)
returns table (messages int, events int, communities int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.messages where user_id = p_user and type = 'text'),
    (select count(*)::int from public.event_participants where user_id = p_user),
    (select count(*)::int from public.community_members where user_id = p_user);
$$;
