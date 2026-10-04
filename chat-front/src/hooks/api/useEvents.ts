// Мероприятия сообщества

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData, sendData } from "@/lib/api";
import type { CommunityEvent, Id } from "@/types";
import { queryKeys } from "./queryKeys";

export function useEvents(communityId: Id, enabled = true) {
  return useQuery({
    queryKey: queryKeys.events(communityId),
    queryFn: () => getData<CommunityEvent[]>(`/communities/${communityId}/events`),
    enabled: enabled && Boolean(communityId),
  });
}

export function useEvent(eventId: Id) {
  return useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: () => getData<CommunityEvent>(`/events/${eventId}`),
    enabled: Boolean(eventId),
    retry: false,
  });
}

export type EventInput = Pick<CommunityEvent, "title" | "description" | "emoji" | "startsAt" | "location" | "maxAttendees">;

export function useCreateEvent(communityId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => sendData<CommunityEvent>("post", `/communities/${communityId}/events`, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.events(communityId) }),
  });
}

export function useToggleEventJoin(communityId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (event: CommunityEvent) =>
      sendData<CommunityEvent>(event.joined ? "delete" : "post", `/events/${event.id}/participation`),
    onSuccess: (event) => {
      queryClient.setQueryData(queryKeys.event(event.id), event);
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(communityId) });
    },
  });
}
