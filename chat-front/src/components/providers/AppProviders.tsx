"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/hooks/api/useAuth";
import { getApiError } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import RealtimeBridge from "./RealtimeBridge";

// Провайдеры всего приложения: кэш React Query, слежение за сессией Supabase и WebSocket (realtime)
export default function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            // 401/403/404 повторять бессмысленно
            retry: (failureCount, error) => {
              const status = getApiError(error).status;
              return status !== null && status >= 400 && status < 500 ? false : failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener queryClient={queryClient} />
      <RealtimeBridge />
      {children}
    </QueryClientProvider>
  );
}

function AuthListener({ queryClient }: { queryClient: QueryClient }) {
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch (error) {
      console.error(error);
      setSession(null);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [setSession, queryClient]);

  return null;
}
