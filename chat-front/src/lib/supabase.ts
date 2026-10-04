// Клиент Supabase для браузера — только с ПУБЛИЧНЫМ anon key.
// Он нужен для трёх вещей: хранить и обновлять сессию, вход через Google и Realtime.
// Данные (профили, сообщения) браузер берёт не отсюда, а из Express API: таблицы закрыты RLS.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Публичный ключ: anon key или новый publishable key (одно и то же назначение)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY — скопируйте .env.local.example в .env.local",
    );
  }
  client = createClient(url, anonKey, {
    // Ссылки из писем и возврат из Google разбирает completeAuthFromUrl() — явно и предсказуемо
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" },
  });
  return client;
}

// Текущий access token (supabase-js сам обновляет его, когда он истекает)
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

// Завершает вход по адресу, на который вернул Supabase: из Google (?code=...),
// из письма подтверждения/восстановления (#access_token=...) или по token_hash.
// Письма отправляет сервер, поэтому в них приходят готовые токены, а не PKCE-код.
// Результат кэшируется: в режиме разработки React вызывает эффекты дважды, а код одноразовый.
let pendingUrlAuth: Promise<string | null> | null = null;

export function completeAuthFromUrl(): Promise<string | null> {
  pendingUrlAuth ??= (async () => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const urlError = query.get("error_description") ?? hash.get("error_description");
    if (urlError) return urlError;

    const supabase = getSupabase();
    const code = query.get("code");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const tokenHash = query.get("token_hash");
    const type = query.get("type");

    let error: { message: string } | null = null;
    if (code) {
      ({ error } = await supabase.auth.exchangeCodeForSession(code));
    } else if (accessToken && refreshToken) {
      ({ error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
    } else if (tokenHash && (type === "signup" || type === "recovery" || type === "email_change" || type === "email")) {
      ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
    }
    // Токены не должны оставаться в адресной строке и истории браузера
    window.history.replaceState(null, "", window.location.pathname);
    return error ? error.message : null;
  })();
  return pendingUrlAuth;
}
