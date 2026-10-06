"use client";

import { useEffect } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useAuthStore } from "@/hooks/api/useAuth";
import { queryKeys } from "@/hooks/api/queryKeys";
import { removeMessage, replaceMessage, upsertMessage } from "@/hooks/api/useMessages";
import { getRealtime } from "@/lib/realtime";
import type { Channel, MessagesPage } from "@/types";

// Связь единственного WebSocket-соединения с React Query (подключается один раз в AppProviders):
// • вошёл — соединение открыто, вышел — закрыто; обновился токен — повторная авторизация;
// • события обновляют кэш напрямую, без перезапроса истории;
// • после обрыва связи пропущенное догружается через REST.
// Вкладка была скрыта дольше этого — считаем соединение ненадёжным и открываем заново
const RESUME_REFRESH_MS = 10_000;

export default function RealtimeBridge() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const accessToken = useAuthStore((state) => state.session?.access_token ?? null);

  // Соединение — только для вошедшего пользователя
  useEffect(() => {
    const realtime = getRealtime();
    if (userId) realtime.start();
    else realtime.stop();
  }, [userId]);

  // supabase-js обновил access token — тот же сокет авторизуется новым токеном
  useEffect(() => {
    if (accessToken) void getRealtime().reauthenticate();
  }, [accessToken]);

  // Телефоны и фоновые вкладки: браузер «усыпляет» страницу и может молча оборвать WebSocket.
  // Вернулись на вкладку после паузы или вернулась сеть — открываем соединение заново
  // и догружаем пропущенные сообщения (событие resync ниже).
  useEffect(() => {
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    const refresh = () => getRealtime().refresh();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const wasHiddenFor = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (wasHiddenFor > RESUME_REFRESH_MS) refresh();
      else getRealtime().reconnectNow();
    };
    // Страница восстановлена из кэша «назад/вперёд» — старое соединение точно не живое
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refresh();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Один обработчик событий на всё приложение — дублей слушателей нет
  useEffect(() => {
    return getRealtime().on((event) => {
      switch (event.type) {
        case "new_message": {
          queryClient.setQueryData<InfiniteData<MessagesPage>>(queryKeys.messages(event.target), (data) =>
            upsertMessage(data, event.message),
          );
          // Счётчик непрочитанных в списке каналов (открытый канал сам сбросит его в 0)
          if (event.target.kind === "channel" && !event.message.isMine) {
            const channelId = event.target.id;
            queryClient.setQueriesData<Channel[]>(
              { predicate: (query) => query.queryKey[0] === "communities" && query.queryKey[2] === "channels" },
              (channels) =>
                channels?.map((channel) =>
                  channel.id === channelId ? { ...channel, unreadCount: channel.unreadCount + 1 } : channel,
                ),
            );
          }
          // Последнее сообщение в списке «Рядом»
          if (event.target.kind === "chat") {
            void queryClient.invalidateQueries({
              predicate: (query) => query.queryKey[0] === "communities" && query.queryKey[2] === "local-chats",
              refetchType: "none", // обновится при следующем открытии списка
            });
          }
          return;
        }
        case "message_updated":
          queryClient.setQueryData<InfiniteData<MessagesPage>>(queryKeys.messages(event.target), (data) =>
            replaceMessage(data, event.message),
          );
          return;
        case "message_deleted":
          queryClient.setQueryData<InfiniteData<MessagesPage>>(queryKeys.messages(event.target), (data) =>
            removeMessage(data, event.messageId),
          );
          return;
        case "notification_created":
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          return;
        case "unsubscribed_chat":
          // Доступ потерян или чат удалён — обновляем списки чатов
          if (event.reason === "access_lost" || event.reason === "deleted") {
            void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
            void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
          }
          return;
        case "resync":
          // Связь восстановлена: всё, что пришло за время обрыва, догружаем через REST
          void queryClient.invalidateQueries({ queryKey: ["messages"] });
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
          void queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === "communities" && query.queryKey[2] === "channels",
          });
          return;
        default:
          return;
      }
    });
  }, [queryClient]);

  return null;
}
