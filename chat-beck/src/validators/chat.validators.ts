import { z } from "zod";
import { emojiSchema, slugId, uuidId } from "./common.validators";

export const chatParams = z.object({ chatId: slugId });
export const messageParams = z.object({ messageId: uuidId });

// Доступ к группе: public — по месту из профиля, private — только по приглашению
export const accessSchema = z.enum(["public", "private"]);

// Новая группа (создаёт только администратор платформы — проверяет сервис по роли из базы).
// Какие привязки нужны для типа — проверяет и zod (понятная ошибка), и CHECK в базе (гарантия):
//   general — без привязок, city — город, district — город и район,
//   school/university — город, район и заведение, local — сообщество (раздел «Рядом»).
export const createChatBody = z
  .object({
    id: slugId.optional(),
    name: z.string().trim().min(2, "Название — минимум 2 символа").max(100),
    type: z.enum(["general", "city", "district", "school", "university", "local"]),
    cityId: slugId.nullable().default(null),
    districtId: slugId.nullable().default(null),
    institutionId: slugId.nullable().default(null),
    communityId: slugId.nullable().default(null),
    description: z.string().trim().max(300).nullable().default(null),
    emoji: emojiSchema.nullable().default(null),
    access: accessSchema.default("public"),
  })
  .superRefine((chat, ctx) => {
    const need = {
      general: [false, false, false, false],
      city: [true, false, false, false],
      district: [true, true, false, false],
      school: [true, true, true, false],
      university: [true, true, true, false],
      local: [false, false, false, true],
    }[chat.type];
    const fields = ["cityId", "districtId", "institutionId", "communityId"] as const;
    fields.forEach((field, index) => {
      const present = chat[field] !== null;
      if (present !== need[index]) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: present ? `Для группы типа «${chat.type}» это поле не нужно` : "Обязательное поле для этого типа группы",
        });
      }
    });
  });

export const updateChatBody = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(300).nullable(),
    emoji: emojiSchema.nullable(),
    access: accessSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Нет данных для изменения" });

export const messagesQuery = z.object({
  // Курсор «<время>|<id сообщения>» из nextCursor: сообщения старше этой точки.
  // id нужен, чтобы не терять сообщения с одинаковым временем на границе страниц.
  before: z
    .string()
    .max(100)
    .regex(/^[0-9T:.+\- ]+\|[0-9a-f-]{36}$/i, "Неверный курсор")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(100).optional(),
});

export const sendMessageBody = z.object({
  content: z.string().trim().min(1, "Сообщение пустое").max(4000, "Сообщение слишком длинное"),
  replyToId: uuidId.nullable().optional(),
});

export const editMessageBody = z.object({
  content: z.string().trim().min(1, "Сообщение пустое").max(4000, "Сообщение слишком длинное"),
});

export const reactionBody = z.object({ emoji: emojiSchema });

export const searchQuery = z.object({
  q: z.string().trim().min(2, "Введите минимум 2 символа").max(100),
});

export const aiAskBody = z.object({
  communityId: slugId,
  question: z.string().trim().min(2).max(500),
});

export type CreateChatInput = z.infer<typeof createChatBody>;
export type UpdateChatInput = z.infer<typeof updateChatBody>;
export type MessagesQuery = z.infer<typeof messagesQuery>;
export type SendMessageInput = z.infer<typeof sendMessageBody>;
