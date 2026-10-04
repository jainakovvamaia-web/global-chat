// Переменные окружения из .env — проверяются при старте сервера.
// Если чего-то не хватает, сервер сразу скажет, чего именно, а не упадёт позже на запросе.

import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  SUPABASE_URL: z.url("SUPABASE_URL — адрес проекта Supabase, например https://xxxx.supabase.co"),
  SUPABASE_ANON_KEY: z.string().min(20, "SUPABASE_ANON_KEY — публичный ключ (Settings → API)"),
  // Секретный ключ: даёт полный доступ к базе. Хранится ТОЛЬКО на сервере, никогда не отдаётся во frontend.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY — секретный ключ (Settings → API)"),
  // Адрес(а) сайта: для CORS, проверки Origin у WebSocket и ссылок в письмах.
  // Можно несколько через запятую: «https://my-app.vercel.app,http://localhost:3000».
  // Первый адрес — основной: он попадает в ссылки из писем (подтверждение email, сброс пароля).
  FRONTEND_URL: z
    .string()
    .default("http://localhost:3000")
    .transform((value, ctx) => {
      const origins: string[] = [];
      // Пробелы, кавычки и «/» в конце не мешают: «"https://x.vercel.app/"» → https://x.vercel.app
      const items = value.split(",").map((part) => part.trim().replace(/^["']+|["']+$/g, "").trim());
      for (const item of items.filter(Boolean)) {
        try {
          const url = new URL(item);
          if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
          origins.push(url.origin); // без завершающего «/» и пути — как браузер присылает Origin
        } catch {
          ctx.addIssue({ code: "custom", message: `FRONTEND_URL: «${item}» — не адрес сайта (нужно https://… или http://…)` });
          return z.NEVER;
        }
      }
      if (origins.length === 0) {
        ctx.addIssue({ code: "custom", message: "FRONTEND_URL — укажите адрес сайта" });
        return z.NEVER;
      }
      return origins;
    }),
  // Секрет для анонимных идентификаторов участников (HMAC). Если не задан — используется service role key.
  // Пустая строка в .env = «не задан»
  MEMBER_ID_SECRET: z
    .union([z.literal(""), z.string().min(32, "MEMBER_ID_SECRET — минимум 32 символа")])
    .optional()
    .transform((value) => value || undefined),
  // AI-помощник: без ключа работает поиск по сообщениям без пересказа
  ANTHROPIC_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`).join("\n");
  console.error(`\nНе хватает настроек в chat-beck/.env:\n${problems}\n\nСкопируйте .env.example в .env и заполните значения.\n`);
  process.exit(1);
}

// FRONTEND_URL — основной адрес сайта (для ссылок в письмах), FRONTEND_ORIGINS — все разрешённые
export const env = {
  ...parsed.data,
  FRONTEND_URL: parsed.data.FRONTEND_URL[0] ?? "http://localhost:3000",
  FRONTEND_ORIGINS: parsed.data.FRONTEND_URL,
};
