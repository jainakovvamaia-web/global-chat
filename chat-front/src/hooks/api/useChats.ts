// Чаты по месту (доступные по профилю) и локальные чаты «Рядом».
// Список доступных чатов определяет сервер — frontend ничего не фильтрует сам.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData, sendData } from "@/lib/api";
import type { ChatAccessType, ChatType, GroupChat, Id, LocalChat, PlaceChat } from "@/types";
import { useAuth } from "./useAuth";
import { queryKeys } from "./queryKeys";

export function useChats() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.chats,
    queryFn: () => getData<PlaceChat[]>("/chats"),
    enabled: isAuthenticated,
  });
}

export function useLocalChats(communityId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.localChats(communityId),
    queryFn: () => getData<LocalChat[]>(`/communities/${communityId}/local-chats`),
    enabled: enabled && Boolean(communityId),
  });
}

export function useLocalChat(chatId: Id) {
  return useQuery({
    queryKey: queryKeys.localChat(chatId),
    queryFn: () => getData<LocalChat>(`/local-chats/${chatId}`),
    enabled: Boolean(chatId),
    retry: false,
  });
}

export type LocalChatInput = { name: string; description: string; emoji: string };

export function useCreateLocalChat(communityId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LocalChatInput) => sendData<LocalChat>("post", `/communities/${communityId}/local-chats`, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.localChats(communityId) }),
  });
}

// Вступить / выйти из локального чата. Из закрытого чата после выхода доступа нет — сервер вернёт null
export function useToggleLocalChatJoin(communityId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chat: LocalChat) =>
      sendData<LocalChat | null>("post", `/chats/${chat.id}/${chat.joined ? "leave" : "join"}`),
    onSuccess: (updated, chat) => {
      if (updated) queryClient.setQueryData(queryKeys.localChat(updated.id), updated);
      else void queryClient.invalidateQueries({ queryKey: queryKeys.localChat(chat.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.localChats(communityId) });
    },
  });
}

// ── Группы (создаёт только admin; сервер проверяет роль по базе) ────────────

export interface CreateChatInput {
  name: string;
  description: string | null;
  type: ChatType;
  cityId: Id | null;
  districtId: Id | null;
  institutionId: Id | null;
  communityId: Id | null; // для type = "local"
  access: ChatAccessType;
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChatInput) => sendData<GroupChat>("post", "/chats", input),
    onSuccess: (chat) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      if (chat.communityId) void queryClient.invalidateQueries({ queryKey: queryKeys.localChats(chat.communityId) });
    },
  });
}

// Удалить группу — создатель или admin
export function useDeleteChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chat: Pick<PlaceChat, "id" | "communityId">) => sendData("delete", `/chats/${chat.id}`),
    onSuccess: (_result, chat) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      if (chat.communityId) void queryClient.invalidateQueries({ queryKey: queryKeys.localChats(chat.communityId) });
    },
  });
}

// Выйти из закрытой группы — после этого она пропадёт из списка
export function useLeaveChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chatId: Id) => sendData("post", `/chats/${chatId}/leave`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.chats }),
  });
}
