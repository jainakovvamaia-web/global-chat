// Сообщества, участники, каналы, приглашения, журнал и статистика

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData, sendData } from "@/lib/api";
import type {
  AuditEntry,
  Channel,
  Community,
  CommunityCategory,
  CommunityStats,
  Id,
  Invitation,
  Member,
  MemberRole,
} from "@/types";
import { useAuth } from "./useAuth";
import { queryKeys } from "./queryKeys";

export function useCommunities() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.communities,
    queryFn: () => getData<Community[]>("/communities"),
    enabled: isAuthenticated,
  });
}

export function useCommunity(communityId: Id) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.community(communityId),
    queryFn: () => getData<Community>(`/communities/${encodeURIComponent(communityId)}`),
    enabled: isAuthenticated && Boolean(communityId),
  });
}

// Участники (анонимно) — только для вступивших
export function useMembers(communityId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.members(communityId),
    queryFn: async () => {
      const members = await getData<(Omit<Member, "id"> & { memberId: string })[]>(`/communities/${communityId}/members`);
      return members.map(({ memberId, ...rest }): Member => ({ id: memberId, ...rest }));
    },
    enabled: enabled && Boolean(communityId),
    refetchInterval: 60_000, // статус «онлайн»
  });
}

export function useChannels(communityId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.channels(communityId),
    queryFn: () => getData<Channel[]>(`/communities/${communityId}/channels`),
    enabled: enabled && Boolean(communityId),
    refetchInterval: 60_000, // счётчики непрочитанных в других каналах
  });
}

export function useInvitations(communityId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.invitations(communityId),
    queryFn: () => getData<Invitation[]>(`/communities/${communityId}/invitations`),
    enabled,
  });
}

// Заявки на вступление в закрытое сообщество — анонимно: только id заявки и время
export interface JoinRequest {
  requestId: Id;
  createdAt: string;
}

export function useJoinRequests(communityId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.joinRequests(communityId),
    queryFn: () => getData<JoinRequest[]>(`/communities/${communityId}/join-requests`),
    enabled: enabled && Boolean(communityId),
    refetchInterval: 60_000,
  });
}

export function useAnswerJoinRequest(communityId: Id) {
  const queryClient = useQueryClient();
  const invalidate = useCommunityInvalidation();
  return useMutation({
    mutationFn: (input: { requestId: Id; approve: boolean }) =>
      sendData("post", `/communities/${communityId}/join-requests/${input.requestId}`, { approve: input.approve }),
    onSuccess: () => {
      invalidate(communityId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.joinRequests(communityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(communityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLog(communityId) });
    },
  });
}

export function useAuditLog(communityId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.auditLog(communityId),
    queryFn: () => getData<AuditEntry[]>(`/communities/${communityId}/audit-log`),
    enabled,
  });
}

export function useCommunityStats(communityId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.stats(communityId),
    queryFn: () => getData<CommunityStats>(`/communities/${communityId}/stats`),
    enabled,
  });
}

// ── Изменения ────────────────────────────────────────────────────────────────

// После изменения сообщества обновляем и каталог, и его страницу
function useCommunityInvalidation() {
  const queryClient = useQueryClient();
  return (communityId?: Id) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    if (communityId) void queryClient.invalidateQueries({ queryKey: queryKeys.community(communityId) });
  };
}

export interface NewCommunityInput {
  name: string;
  category: CommunityCategory;
  description: string;
  emoji: string;
  isPrivate: boolean;
}

export function useCreateCommunity() {
  const invalidate = useCommunityInvalidation();
  return useMutation({
    mutationFn: (input: NewCommunityInput) => sendData<Community>("post", "/communities", input),
    onSuccess: () => invalidate(),
  });
}

export function useJoinCommunity() {
  const invalidate = useCommunityInvalidation();
  return useMutation({
    mutationFn: (communityId: Id) => sendData<Community>("post", `/communities/${communityId}/join`),
    onSuccess: (community) => invalidate(community.id),
  });
}

export function useJoinByCode() {
  const invalidate = useCommunityInvalidation();
  return useMutation({
    mutationFn: (code: string) => sendData<Community>("post", "/communities/join-by-code", { code }),
    onSuccess: (community) => invalidate(community.id),
  });
}

export function useRequestAccess() {
  const invalidate = useCommunityInvalidation();
  return useMutation({
    mutationFn: (communityId: Id) => sendData<Community>("post", `/communities/${communityId}/request-access`),
    onSuccess: (community) => invalidate(community.id),
  });
}

export function useSetMemberRole(communityId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { memberId: Id; role: Exclude<MemberRole, "owner"> }) =>
      sendData("patch", `/communities/${communityId}/members/${input.memberId}`, { role: input.role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(communityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLog(communityId) });
    },
  });
}

export function useRemoveMember(communityId: Id) {
  const queryClient = useQueryClient();
  const invalidate = useCommunityInvalidation();
  return useMutation({
    mutationFn: (memberId: Id) => sendData("delete", `/communities/${communityId}/members/${memberId}`),
    onSuccess: () => {
      invalidate(communityId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(communityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLog(communityId) });
    },
  });
}

export function useCreateInvitation(communityId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendData<Invitation>("post", `/communities/${communityId}/invitations`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations(communityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLog(communityId) });
    },
  });
}

export type ChannelInput = Pick<Channel, "name" | "description" | "emoji" | "isAnnouncements">;

function useChannelInvalidation(communityId: Id) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.channels(communityId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.auditLog(communityId) });
  };
}

export function useCreateChannel(communityId: Id) {
  const invalidate = useChannelInvalidation(communityId);
  return useMutation({
    mutationFn: (input: ChannelInput) => sendData<Channel>("post", `/communities/${communityId}/channels`, input),
    onSuccess: invalidate,
  });
}

export function useUpdateChannel(communityId: Id) {
  const invalidate = useChannelInvalidation(communityId);
  return useMutation({
    mutationFn: (input: ChannelInput & { id: Id }) => {
      const { id, ...body } = input;
      return sendData<Channel>("patch", `/channels/${id}`, body);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteChannel(communityId: Id) {
  const invalidate = useChannelInvalidation(communityId);
  return useMutation({
    mutationFn: (channelId: Id) => sendData("delete", `/channels/${channelId}`),
    onSuccess: invalidate,
  });
}

// Канал открыт — отмечаем прочитанным и сразу обнуляем счётчик в кэше
export function useMarkChannelRead(communityId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: Id) => sendData("post", `/channels/${channelId}/read`),
    onMutate: (channelId) => {
      queryClient.setQueryData<Channel[]>(queryKeys.channels(communityId), (channels) =>
        channels?.map((channel) => (channel.id === channelId ? { ...channel, unreadCount: 0 } : channel)),
      );
    },
  });
}

// Права по ролям — только для показа кнопок. Настоящую проверку делает сервер.
export const canManageCommunity = (role: MemberRole | null | undefined) => role === "owner" || role === "admin";
export const canModerate = (role: MemberRole | null | undefined) =>
  role === "owner" || role === "admin" || role === "moderator";
