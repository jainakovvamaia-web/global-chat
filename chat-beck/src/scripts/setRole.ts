// Назначение роли пользователю — только на сервере, с секретным ключом из chat-beck/.env.
// Через сайт или API роль изменить нельзя: так появляется первый администратор.
//
//   npm run set-role -- user@example.com admin   — сделать администратором
//   npm run set-role -- user@example.com user    — снять права администратора
//
// Пользователь должен быть уже зарегистрирован.

import { supabaseAdmin } from "../config/supabase";
import type { UserRole } from "../types/database.types";

const ROLES: UserRole[] = ["user", "admin"];

async function main(): Promise<void> {
  const [emailArg, roleArg] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const role = ROLES.find((item) => item === roleArg);
  if (!email || !role) {
    console.error("Использование: npm run set-role -- <email> <user|admin>");
    process.exit(1);
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("email", email)
    .select("id, email, role");
  if (error) {
    console.error("Ошибка базы:", error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error(`Пользователь ${email} не найден. Сначала зарегистрируйтесь на сайте с этим email.`);
    process.exit(1);
  }
  console.log(`Готово: ${email} теперь ${role === "admin" ? "администратор" : "обычный пользователь"}.`);
  console.log("Обновите страницу сайта, чтобы появились кнопки администратора.");
}

void main();
