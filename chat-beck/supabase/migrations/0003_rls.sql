-- Global Community Chat — Row Level Security и права на функции.
--
-- Модель безопасности:
--   • Браузер НЕ работает с таблицами напрямую — все данные идут через Express API,
--     который проверяет права и использует service role key (он хранится только на сервере).
--   • RLS включён на ВСЕХ таблицах. Для ролей anon/authenticated открыто только чтение
--     справочников (города, районы, заведения). Остальное закрыто — даже если кто-то
--     возьмёт anon key из браузера, прочитать сообщения или профили напрямую он не сможет.
--   • Realtime: подписаться на тему чата можно только при доступе к этому чату.

alter table public.cities             enable row level security;
alter table public.districts          enable row level security;
alter table public.institutions       enable row level security;
alter table public.profiles           enable row level security;
alter table public.communities        enable row level security;
alter table public.community_members  enable row level security;
alter table public.join_requests      enable row level security;
alter table public.invitations        enable row level security;
alter table public.audit_log          enable row level security;
alter table public.channels           enable row level security;
alter table public.channel_reads      enable row level security;
alter table public.chats              enable row level security;
alter table public.chat_members       enable row level security;
alter table public.messages           enable row level security;
alter table public.message_reactions  enable row level security;
alter table public.notifications      enable row level security;
alter table public.events             enable row level security;
alter table public.event_participants enable row level security;

-- Справочники публичные: их видно даже на странице регистрации
drop policy if exists "Справочник городов доступен всем" on public.cities;
create policy "Справочник городов доступен всем" on public.cities
  for select to anon, authenticated using (true);

drop policy if exists "Справочник районов доступен всем" on public.districts;
create policy "Справочник районов доступен всем" on public.districts
  for select to anon, authenticated using (true);

drop policy if exists "Справочник заведений доступен всем" on public.institutions;
create policy "Справочник заведений доступен всем" on public.institutions
  for select to anon, authenticated using (true);

-- Свой профиль пользователь может прочитать сам (чужой — нет)
drop policy if exists "Свой профиль виден владельцу" on public.profiles;
create policy "Свой профиль виден владельцу" on public.profiles
  for select to authenticated using (id = auth.uid());

-- ── Realtime: приватные каналы ────────────────────────────────────────────────

drop policy if exists "Realtime: только доступные темы" on realtime.messages;
create policy "Realtime: только доступные темы" on realtime.messages
  for select to authenticated
  using (public.can_receive_topic(realtime.topic()));

-- ── Права на функции ─────────────────────────────────────────────────────────
-- Функции с security definer закрыты для клиентов: иначе через API Supabase можно было бы,
-- например, проверить доступ ЧУЖОГО пользователя к чату и узнать его район.
-- Их вызывает только Express (service_role). can_receive_topic открыта — её вызывает
-- политика Realtime, и она проверяет только текущего пользователя (auth.uid()).

revoke execute on function public.can_access_chat(uuid, text) from public, anon, authenticated;
revoke execute on function public.available_chats(uuid) from public, anon, authenticated;
revoke execute on function public.can_read_channel(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.join_city_communities(uuid) from public, anon, authenticated;
revoke execute on function public.channel_unread_counts(uuid, text) from public, anon, authenticated;
revoke execute on function public.community_weekly_messages(text) from public, anon, authenticated;
revoke execute on function public.community_counts(text[]) from public, anon, authenticated;
revoke execute on function public.chat_member_counts(text[]) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.broadcast_message_change() from public, anon, authenticated;
revoke execute on function public.broadcast_reaction_change() from public, anon, authenticated;
revoke execute on function public.broadcast_notification() from public, anon, authenticated;
revoke execute on function public.create_place_chat_for_city() from public, anon, authenticated;
revoke execute on function public.create_place_chat_for_district() from public, anon, authenticated;
revoke execute on function public.create_place_chat_for_institution() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
revoke execute on function public.redeem_invitation(text, uuid) from public, anon, authenticated;
revoke execute on function public.join_event(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.chat_last_messages(text[]) from public, anon, authenticated;
revoke execute on function public.user_stats(uuid) from public, anon, authenticated;

grant execute on function public.can_access_chat(uuid, text) to service_role;
grant execute on function public.available_chats(uuid) to service_role;
grant execute on function public.can_read_channel(uuid, uuid) to service_role;
grant execute on function public.join_city_communities(uuid) to service_role;
grant execute on function public.channel_unread_counts(uuid, text) to service_role;
grant execute on function public.community_weekly_messages(text) to service_role;
grant execute on function public.community_counts(text[]) to service_role;
grant execute on function public.chat_member_counts(text[]) to service_role;
grant execute on function public.redeem_invitation(text, uuid) to service_role;
grant execute on function public.join_event(uuid, uuid) to service_role;
grant execute on function public.chat_last_messages(text[]) to service_role;
grant execute on function public.user_stats(uuid) to service_role;

revoke execute on function public.can_receive_topic(text) from public, anon;
grant execute on function public.can_receive_topic(text) to authenticated;
