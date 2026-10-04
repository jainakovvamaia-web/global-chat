// Уведомления. О новых сервер сообщает событием WebSocket notification_created —
// RealtimeBridge обновляет этот список (см. components/providers/RealtimeBridge.tsx)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData, sendData } from "@/lib/api";
import type { AppNotification, Id } from "@/types";
import { useAuth } from "./useAuth";
import { queryKeys } from "./queryKeys";

interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => getData<NotificationsResponse>("/notifications"),
    enabled: userId !== null,
  });

  return {
    ...query,
    notifications: query.data?.items ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
  };
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => sendData("post", `/notifications/${id}/read`),
    onMutate: (id) => {
      queryClient.setQueryData<NotificationsResponse>(queryKeys.notifications, (data) => {
        if (!data) return data;
        const target = data.items.find((item) => item.id === id);
        if (!target || target.isRead) return data;
        return {
          items: data.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
          unreadCount: Math.max(0, data.unreadCount - 1),
        };
      });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sendData("post", "/notifications/read-all"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
