// Вход, регистрация, выход. Сессию хранит и обновляет supabase-js (в браузере),
// а пароль проверяет Supabase Auth через наш Express API — пароль нигде у нас не хранится.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { sendData } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type { LocationSelection, Profile } from "@/types";
import { queryKeys } from "./queryKeys";

// Текущая сессия (заполняет AuthListener в AppProviders)
interface AuthState {
  session: Session | null;
  isReady: boolean; // сессия уже прочитана из хранилища браузера
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isReady: false,
  setSession: (session) => set({ session, isReady: true }),
}));

interface AuthResult {
  session: { accessToken: string; refreshToken: string; expiresAt: number | null } | null;
  profile: Profile | null;
  needsEmailConfirmation: boolean;
}

// Сессия, выданная сервером, передаётся supabase-js: дальше он сам её хранит и продлевает
async function applySession(result: AuthResult): Promise<void> {
  if (!result.session) return;
  const { error } = await getSupabase().auth.setSession({
    access_token: result.session.accessToken,
    refresh_token: result.session.refreshToken,
  });
  if (error) throw error;
}

export function useAuth() {
  const session = useAuthStore((state) => state.session);
  const isReady = useAuthStore((state) => state.isReady);
  return { session, isReady, isAuthenticated: session !== null };
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const result = await sendData<AuthResult>("post", "/auth/login", input);
      await applySession(result);
      return result;
    },
  });
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  location: LocationSelection;
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const result = await sendData<AuthResult>("post", "/auth/register", input);
      await applySession(result);
      return result;
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await sendData("post", "/auth/logout"); // отзываем токен на сервере
      } finally {
        await getSupabase().auth.signOut({ scope: "local" });
        queryClient.clear(); // данные прошлого пользователя не должны остаться в кэше
      }
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => sendData<{ message: string }>("post", "/auth/forgot-password", { email }),
  });
}

// Смена пароля: сервер сначала проверяет текущий пароль (если он у аккаунта есть)
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      sendData("patch", "/auth/password", input),
  });
}

// Новый пароль по ссылке из письма восстановления. Ссылка даёт свежую сессию восстановления,
// поэтому пароль меняется напрямую в Supabase Auth — без текущего пароля (его человек и забыл).
export function useResetPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
  });
}

// Смена email — стандартный процесс Supabase Auth: на новый адрес приходит письмо,
// и только после подтверждения email меняется (профиль обновит триггер в базе)
export function useChangeEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await getSupabase().auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/auth/callback` },
      );
      if (error) throw new Error(error.message);
    },
  });
}

// Удаление аккаунта: сервер удаляет пользователя Supabase Auth, профиль и его данные (каскад)
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await sendData("delete", "/auth/account");
      await getSupabase().auth.signOut({ scope: "local" });
      queryClient.clear();
    },
  });
}

// Вход через Google идёт напрямую через Supabase (так работает OAuth), затем /auth/callback
export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

export function useInvalidateMe() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.me });
}
