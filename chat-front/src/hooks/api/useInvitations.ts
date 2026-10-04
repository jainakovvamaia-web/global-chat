// Приглашения в закрытые группы и вход по коду.
// Коды видит и создаёт только создатель группы или admin — сервер проверяет это сам.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData, sendData } from "@/lib/api";
import type { Id, Invitation, JoinByInvitationResult } from "@/types";
import { queryKeys } from "./queryKeys";

export function useChatInvitations(chatId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.chatInvitations(chatId),
    queryFn: () => getData<Invitation[]>(`/chats/${chatId}/invitations`),
    enabled: enabled && Boolean(chatId),
  });
}

// expiresAt — ISO-дата окончания (null — бессрочно), maxUses — лимит (1 — одноразовый, null — без лимита)
export interface CreateInvitationInput {
  expiresAt: string | null;
  maxUses: number | null;
}

export function useCreateChatInvitation(chatId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvitationInput) => sendData<Invitation>("post", `/chats/${chatId}/invitations`, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.chatInvitations(chatId) }),
  });
}

export function useDeactivateInvitation(chatId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: Id) => sendData<Invitation>("post", `/invitations/${invitationId}/deactivate`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.chatInvitations(chatId) }),
  });
}

// Вход по коду: подходит и для закрытой группы, и для закрытого сообщества.
// После входа обновляем списки — группа сразу появляется без перезагрузки страницы.
export function useJoinByInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      sendData<JoinByInvitationResult>("post", "/invitations/join", { code: code.trim().toUpperCase() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      void queryClient.invalidateQueries({ queryKey: queryKeys.communities }); // + локальные чаты сообществ
    },
  });
}
