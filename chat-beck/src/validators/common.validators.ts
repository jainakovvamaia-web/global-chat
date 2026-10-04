// Общие части схем: id, пагинация, текстовые поля

import { z } from "zod";

// id справочников и чатов: латиница, цифры, дефисы («pervomaisky», «knu-news»)
export const slugId = z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, "Неверный идентификатор");
export const uuidId = z.uuid("Неверный идентификатор");

export const idParams = z.object({ id: slugId });
export const uuidParams = z.object({ id: uuidId });

// Пустая строка из <select> = «не выбрано»
export const optionalSlug = z
  .union([slugId, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const institutionTypeSchema = z.enum(["school", "university"]);

export const emojiSchema = z.string().trim().min(1).max(16);
