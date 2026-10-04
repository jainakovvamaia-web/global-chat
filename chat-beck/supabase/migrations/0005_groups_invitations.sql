-- Global Community Chat — роли, закрытые группы и приглашения в группы.
-- Отдельная миграция поверх 0001–0004: существующие данные не удаляются и не меняются.
-- Повторяемая: её можно запустить ещё раз.
--
-- Что добавляет:
--   • защиту роли: обычный пользователь не может сделать себя admin ни через API, ни через Supabase напрямую;
--   • закрытые группы (chats.is_private): доступ только участникам, создателю и admin платформы;
--   • приглашения в группы — в существующей таблице invitations (у кода теперь ровно одна цель:
--     сообщество ИЛИ группа), поля id и is_active;
--   • вход по коду для групп и сообществ одной функцией redeem_invitation.

-- ── 1. Роль пользователя ────────────────────────────────────────────────────
-- Роль уже есть: profiles.role text not null default 'user' check (role in ('user','admin')).
-- Менять её может только сервер (service_role) или администратор базы в SQL Editor.
-- Браузер с ключом anon/authenticated — никогда, даже если кто-то добавит лишнюю RLS-политику.

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.role <> 'user' then
      raise exception 'Нельзя создать профиль с ролью %', new.role using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Роль пользователя меняет только администратор' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- ── 2. Закрытые группы ──────────────────────────────────────────────────────
-- is_private = false (по умолчанию) — доступ по прежним правилам: город, район, учебное заведение,
--   участники сообщества для локальных чатов.
-- is_private = true — только участники (chat_members), создатель и admin платформы.

alter table public.chats add column if not exists is_private boolean not null default false;
alter table public.chats add column if not exists updated_at timestamptz not null default now();
create index if not exists chats_private_idx on public.chats (is_private) where is_private;

drop trigger if exists chats_set_updated_at on public.chats;
create trigger chats_set_updated_at before update on public.chats
  for each row execute function public.set_updated_at();

-- Подходит ли открытый чат пользователю по месту из профиля (единственное место с этими правилами)
create or replace function public.chat_matches_profile(c public.chats, p public.profiles)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
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
          where m.community_id = c.community_id and m.user_id = p.id));
$$;

create or replace function public.is_chat_member(p_user uuid, p_chat text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.chat_members where chat_id = p_chat and user_id = p_user);
$$;

-- Кто может открыть чат (сообщения, Realtime). Используется и Express, и политикой Realtime.
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
        p.role = 'admin'                       -- администратор платформы управляет всеми группами
        or c.created_by = p_user               -- создатель группы
        or (c.is_private and public.is_chat_member(p_user, c.id))
        or (not c.is_private and public.chat_matches_profile(c, p))
      )
  );
$$;

-- Список «Мои чаты» (без локальных чатов «Рядом»): открытые — по профилю,
-- закрытые — где пользователь участник или создатель. Админ видит здесь только «свои» закрытые
-- группы, чтобы список не превращался в перечень всех чатов платформы.
create or replace function public.available_chats(p_user uuid)
returns setof public.chats
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.chats c
  join public.profiles p on p.id = p_user
  where c.type <> 'local'
    and (
      (c.is_private and (c.created_by = p_user or public.is_chat_member(p_user, c.id)))
      or (not c.is_private and public.chat_matches_profile(c, p))
    )
  order by
    case c.type when 'general' then 0 when 'city' then 1 when 'district' then 2 else 3 end,
    c.created_at,
    c.name;
$$;

-- ── 3. Приглашения в группы ─────────────────────────────────────────────────
-- Используем существующую таблицу invitations, чтобы не было второго механизма кодов.

alter table public.invitations add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists invitations_id_idx on public.invitations (id);
alter table public.invitations add column if not exists chat_id text references public.chats (id) on delete cascade;
alter table public.invitations alter column community_id drop not null;
-- is_active вычисляется базой: код активен, пока его не отозвали
alter table public.invitations add column if not exists is_active boolean generated always as (revoked_at is null) stored;
create index if not exists invitations_chat_idx on public.invitations (chat_id) where chat_id is not null;

alter table public.invitations drop constraint if exists invitations_one_target;
alter table public.invitations add constraint invitations_one_target
  check (num_nonnulls(community_id, chat_id) = 1);

-- Формат кода: «KNU-7F4X9QZ2» (префикс по названию) или прежний «7F4X9QZ2»
alter table public.invitations drop constraint if exists invitations_code_check;
alter table public.invitations drop constraint if exists invitations_code_format;
alter table public.invitations add constraint invitations_code_format
  check (code ~ '^([A-Z0-9]{2,6}-)?[A-Z0-9]{6,16}$');

-- Вход по коду: проверка и использование одной транзакцией, с блокировкой строки кода.
-- p_kind: 'chat' | 'community' | null (любой). Код чужого вида считается неверным.
-- Статус: joined | already_member | not_found | revoked | expired | used_up.
drop function if exists public.redeem_invitation(text, uuid);

create or replace function public.redeem_invitation(p_code text, p_user uuid, p_kind text default null)
returns table (community_id text, chat_id text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations;
  inserted int;
begin
  select * into inv from public.invitations i where i.code = p_code for update;
  if not found
     or (p_kind = 'chat' and inv.chat_id is null)
     or (p_kind = 'community' and inv.community_id is null) then
    return query select null::text, null::text, 'not_found'::text;
    return;
  end if;

  if (inv.community_id is not null and exists (
        select 1 from public.community_members m where m.community_id = inv.community_id and m.user_id = p_user))
     or (inv.chat_id is not null and public.is_chat_member(p_user, inv.chat_id)) then
    return query select inv.community_id, inv.chat_id, 'already_member'::text;
    return;
  end if;
  if inv.revoked_at is not null then
    return query select inv.community_id, inv.chat_id, 'revoked'::text;
    return;
  end if;
  if inv.expires_at is not null and inv.expires_at <= now() then
    return query select inv.community_id, inv.chat_id, 'expired'::text;
    return;
  end if;
  if inv.max_uses is not null and inv.uses_count >= inv.max_uses then
    return query select inv.community_id, inv.chat_id, 'used_up'::text;
    return;
  end if;

  if inv.chat_id is not null then
    insert into public.chat_members (chat_id, user_id) values (inv.chat_id, p_user) on conflict do nothing;
  else
    insert into public.community_members (community_id, user_id, role)
    values (inv.community_id, p_user, 'member')
    on conflict do nothing;
  end if;
  get diagnostics inserted = row_count;

  if inserted = 0 then
    return query select inv.community_id, inv.chat_id, 'already_member'::text;
    return;
  end if;

  update public.invitations set uses_count = uses_count + 1 where code = inv.code;
  if inv.community_id is not null then
    delete from public.join_requests j where j.community_id = inv.community_id and j.user_id = p_user;
  end if;
  return query select inv.community_id, inv.chat_id, 'joined'::text;
end;
$$;

-- ── 4. Права на функции ─────────────────────────────────────────────────────
-- Клиентам (anon/authenticated) эти функции недоступны: их вызывает только Express (service_role).

revoke execute on function public.protect_profile_role() from public, anon, authenticated;
revoke execute on function public.chat_matches_profile(public.chats, public.profiles) from public, anon, authenticated;
revoke execute on function public.is_chat_member(uuid, text) from public, anon, authenticated;
revoke execute on function public.can_access_chat(uuid, text) from public, anon, authenticated;
revoke execute on function public.available_chats(uuid) from public, anon, authenticated;
revoke execute on function public.redeem_invitation(text, uuid, text) from public, anon, authenticated;

grant execute on function public.chat_matches_profile(public.chats, public.profiles) to service_role;
grant execute on function public.is_chat_member(uuid, text) to service_role;
grant execute on function public.can_access_chat(uuid, text) to service_role;
grant execute on function public.available_chats(uuid) to service_role;
grant execute on function public.redeem_invitation(text, uuid, text) to service_role;

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
-- RLS включён на всех таблицах (0003_rls.sql). Для anon/authenticated нет политик на
-- chats, chat_members, invitations, messages и на изменение profiles — значит, из браузера их
-- нельзя ни читать, ни менять. Создание групп, приглашения и вступление идут только через
-- Express, который проверяет JWT, роль и членство. Повторно включаем RLS на случай,
-- если его выключали вручную.
alter table public.profiles     enable row level security;
alter table public.chats        enable row level security;
alter table public.chat_members enable row level security;
alter table public.invitations  enable row level security;
alter table public.messages     enable row level security;
