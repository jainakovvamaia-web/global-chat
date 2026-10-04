// Свой профиль и настройки (GET/PATCH /api/auth/profile, /api/auth/settings)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData, sendData } from "@/lib/api";
import type { InstitutionType, LocationSelection, Profile, UserSettings } from "@/types";
import { useAuth } from "./useAuth";
import { queryKeys } from "./queryKeys";

// Так профиль приходит с сервера: пустые значения — null
interface ProfileResponse extends Omit<Profile, "location"> {
  location: {
    cityId: string | null;
    districtId: string | null;
    institutionType: InstitutionType | null;
    institutionId: string | null;
  };
}

// Для <select> удобнее пустые строки вместо null
const toProfile = (data: ProfileResponse): Profile => ({
  ...data,
  location: {
    cityId: data.location.cityId ?? "",
    districtId: data.location.districtId ?? "",
    institutionType: data.location.institutionType ?? "",
    institutionId: data.location.institutionId ?? "",
  },
});

export function useProfile() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => toProfile(await getData<ProfileResponse>("/auth/me")),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

export interface ProfilePatch {
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  location?: LocationSelection;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => toProfile(await sendData<ProfileResponse>("patch", "/auth/profile", patch)),
    onSuccess: (profile, patch) => {
      queryClient.setQueryData(queryKeys.me, profile);
      // Новое место — другой набор доступных чатов и, возможно, новые сообщества города
      if (patch.location) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chats });
        void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
      }
    },
  });
}

// Моя статистика для профиля: сколько я написал сообщений, в скольких событиях и сообществах участвую
export interface MyStats {
  messages: number;
  events: number;
  communities: number;
}

export function useMyStats() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.myStats,
    queryFn: () => getData<MyStats>("/auth/stats"),
    enabled: isAuthenticated,
  });
}

export function useSettings() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => getData<UserSettings>("/auth/settings"),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

export type SettingsPatch = {
  notifications?: Partial<UserSettings["notifications"]>;
  privacy?: Partial<UserSettings["privacy"]>;
  theme?: UserSettings["theme"];
};

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => sendData<UserSettings>("patch", "/auth/settings", patch),
    // Переключатель меняется сразу, не дожидаясь ответа сервера
    onMutate: (patch) => {
      queryClient.setQueryData<UserSettings>(queryKeys.settings, (current) =>
        current
          ? {
              notifications: { ...current.notifications, ...patch.notifications },
              privacy: { ...current.privacy, ...patch.privacy },
              theme: patch.theme ?? current.theme,
            }
          : current,
      );
    },
    onSuccess: (settings) => queryClient.setQueryData(queryKeys.settings, settings),
    onError: () => void queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
  });
}
