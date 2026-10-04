// Клиенты Supabase для сервера.
//
// supabaseAdmin — с service role key: обходит RLS, поэтому ВСЕ проверки прав делают сервисы Express.
//   Используется только на сервере.
// createAuthClient() — с публичным anon key, для регистрации и входа. Для каждого запроса
//   создаётся новый клиент: у клиента Supabase есть внутреннее состояние сессии, и общий клиент
//   мог бы перепутать сессии разных пользователей при одновременных запросах.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { env } from "./env";

const serverAuthOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

export const supabaseAdmin = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  serverAuthOptions,
);

export const createAuthClient = () =>
  createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, serverAuthOptions);
