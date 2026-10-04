// Серверная валидация через zod. Данным с frontend не доверяем:
// контроллер прогоняет body / params / query через схему и получает уже проверенный
// и типизированный результат. При ошибке — 400 с понятным сообщением.

import type { z } from "zod";
import { apiErrors } from "../utils/apiErrors";

export function validate<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path.length ? `${first.path.join(".")}: ` : "";
    throw apiErrors.badRequest(`${field}${first?.message ?? "Неверные данные"}`, "VALIDATION_ERROR");
  }
  return result.data;
}
