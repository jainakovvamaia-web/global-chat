// Помощники для ответов Supabase: вместо проверки { data, error } в каждом месте —
// одна функция, которая превращает ошибку базы в понятную ошибку API.

import type { PostgrestError } from "@supabase/supabase-js";
import { apiErrors, type ApiError } from "./apiErrors";

// Коды PostgreSQL → ошибки API (https://www.postgresql.org/docs/current/errcodes-appendix.html)
function toApiError(error: PostgrestError): ApiError {
  switch (error.code) {
    case "23505": // unique_violation
      return apiErrors.conflict("Такая запись уже существует", "ALREADY_EXISTS");
    case "23503": // foreign_key_violation
      return apiErrors.badRequest("Связанная запись не найдена (город, район, заведение и т.п.)", "INVALID_REFERENCE");
    case "23514": // check_violation
    case "22P02": // invalid_text_representation (например, неверный uuid)
      return apiErrors.badRequest("Неверные данные", "INVALID_DATA");
    default:
      console.error("Ошибка Supabase:", error);
      return apiErrors.internal();
  }
}

// Тип данных берём прямо из ответа (R["data"]), а не выводим generic — так TypeScript
// правильно понимает ответы supabase-js, которые являются объединением «успех | ошибка».
interface DbResult {
  data: unknown;
  error: PostgrestError | null;
}

// Данные обязательны: нет строки — 404 (с переданным сообщением)
export function must<R extends DbResult>(result: R, notFoundMessage = "Не найдено"): NonNullable<R["data"]> {
  if (result.error) throw toApiError(result.error);
  if (result.data === null || result.data === undefined) throw apiErrors.notFound(notFoundMessage);
  return result.data as NonNullable<R["data"]>;
}

// Данные могут отсутствовать (maybeSingle): null — это не ошибка
export function maybe<R extends DbResult>(result: R): R["data"] | null {
  if (result.error) throw toApiError(result.error);
  return result.data;
}

// Для запросов без нужных данных (insert/update/delete)
export function check(result: { error: PostgrestError | null }): void {
  if (result.error) throw toApiError(result.error);
}

// Количество строк из запроса с { count: "exact", head: true }
export function countOf(result: { count: number | null; error: PostgrestError | null }): number {
  if (result.error) throw toApiError(result.error);
  return result.count ?? 0;
}

// Спецсимволы LIKE экранируются, чтобы «%» и «_» в поиске искались буквально
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
