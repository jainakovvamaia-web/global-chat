// Сообщения чата или канала: история частями через REST + события в реальном времени по WebSocket.
//
// История и пагинация — GET через Express. Новые, изменённые и удалённые сообщения приходят
// событиями WebSocket (lib/realtime.ts) и сразу попадают в кэш React Query — без перезапроса.
// Подписаться на чужой чат нельзя: доступ при подписке проверяет сервер.

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { getData, sendData } from "@/lib/api";
import { useRealtimeTopic } from "@/hooks/useRealtime";
import type { Id, Message, MessagesPage } from "@/types";
import { queryKeys, type MessageTarget } from "./queryKeys";

export type { MessageTarget } from "./queryKeys";

const PAGE_SIZE = 50;
const basePath = (target: MessageTarget) => (target.kind === "chat" ? `/chats/${target.id}` : `/channels/${target.id}`);

export function useMessages(target: MessageTarget) {
  const key = queryKeys.messages(target);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      getData<MessagesPage>(`${basePath(target)}/messages`, { limit: PAGE_SIZE, before: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor, // следующая «страница» — более старые сообщения
  });

  // Подписка на события этого чата/канала по общему WebSocket-соединению
  useRealtimeTopic(target);

  // Страницы идут от новых к старым, внутри страницы — от старых к новым
  const messages: Message[] = query.data ? [...query.data.pages].reverse().flatMap((page) => page.items) : [];

  return { ...query, messages };
}

// Заменить или добавить сообщение в кэше, не дожидаясь перезагрузки.
// Дедупликация по message.id: одно и то же сообщение (ответ REST и событие WebSocket) не задвоится.
export function upsertMessage(data: InfiniteData<MessagesPage> | undefined, message: Message) {
  if (!data) return data;
  const exists = data.pages.some((page) => page.items.some((item) => item.id === message.id));
  const pages = data.pages.map((page, index) => {
    if (exists) return { ...page, items: page.items.map((item) => (item.id === message.id ? message : item)) };
    return index === 0 ? { ...page, items: [...page.items, message] } : page;
  });
  return { ...data, pages };
}

// Изменённое сообщение (правка, реакции) — только если оно уже загружено в историю
export function replaceMessage(data: InfiniteData<MessagesPage> | undefined, message: Message) {
  if (!data || !data.pages.some((page) => page.items.some((item) => item.id === message.id))) return data;
  return upsertMessage(data, message);
}

export function removeMessage(data: InfiniteData<MessagesPage> | undefined, messageId: Id) {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => item.id !== messageId) })) };
}

export function useSendMessage(target: MessageTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; replyToId: Id | null }) =>
      sendData<Message>("post", `${basePath(target)}/messages`, input),
    onSuccess: (message) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(queryKeys.messages(target), (data) => upsertMessage(data, message));
    },
  });
}

export function useEditMessage(target: MessageTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: Id; content: string }) => sendData<Message>("patch", `/messages/${input.id}`, { content: input.content }),
    onSuccess: (message) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(queryKeys.messages(target), (data) => upsertMessage(data, message));
    },
  });
}

export function useDeleteMessage(target: MessageTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId: Id) => sendData("delete", `/messages/${messageId}`),
    onSuccess: (_result, messageId) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(queryKeys.messages(target), (data) => removeMessage(data, messageId));
    },
  });
}

export function useToggleReaction(target: MessageTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { messageId: Id; emoji: string }) =>
      sendData<Message>("post", `/messages/${input.messageId}/reactions`, { emoji: input.emoji }),
    onSuccess: (message) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(queryKeys.messages(target), (data) => upsertMessage(data, message));
    },
  });
}
