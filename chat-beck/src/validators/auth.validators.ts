// Регистрация, вход, профиль. Пароль проверяется здесь, но хранит его только Supabase Auth.

import { z } from "zod";
import { institutionTypeSchema, optionalSlug, slugId } from "./common.validators";

const name = z.string().trim().min(1, "Заполните поле").max(100);
const email = z.email("Неверный email").trim().toLowerCase().max(254);
const password = z
  .string()
  .min(8, "Пароль — минимум 8 символов")
  .max(72, "Пароль — максимум 72 символа")
  .regex(/[A-Za-zА-Яа-я]/, "В пароле нужна хотя бы одна буква")
  .regex(/\d/, "В пароле нужна хотя бы одна цифра");

// Место: город и район обязательны, заведение — по желанию, но тип и id вместе
export const locationSchema = z
  .object({
    cityId: slugId,
    districtId: slugId,
    institutionType: z
      .union([institutionTypeSchema, z.literal(""), z.null()])
      .optional()
      .transform((value) => (value ? value : null)),
    institutionId: optionalSlug,
  })
  .refine((value) => (value.institutionType === null) === (value.institutionId === null), {
    message: "Выберите тип и учебное заведение вместе",
    path: ["institutionId"],
  });

export const registerBody = z.object({
  firstName: name,
  lastName: name,
  email,
  password,
  location: locationSchema,
});

export const loginBody = z.object({ email, password: z.string().min(1, "Введите пароль").max(72) });

export const forgotPasswordBody = z.object({ email });

// Текущий пароль обязателен, если он у аккаунта есть (проверяет сервис)
export const changePasswordBody = z.object({
  currentPassword: z.string().max(72).default(""),
  newPassword: password,
});

export const updateProfileBody = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    username: z
      .string()
      .trim()
      .min(3, "Имя пользователя — минимум 3 символа")
      .max(32)
      .regex(/^[a-zA-Z0-9_.]+$/, "Только латиница, цифры, точка и _")
      .optional(),
    bio: z.string().trim().max(500).optional(),
    location: locationSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Нет данных для изменения" });

export const updateSettingsBody = z.object({
  notifications: z
    .object({
      messages: z.boolean(),
      mentions: z.boolean(),
      replies: z.boolean(),
      announcements: z.boolean(),
      events: z.boolean(),
    })
    .partial()
    .optional(),
  privacy: z
    .object({
      whoCanMessage: z.enum(["Все", "Только участники сообщества", "Никто"]),
      whoSeesOnline: z.enum(["Все", "Только друзья", "Никто"]),
    })
    .partial()
    .optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

export type RegisterInput = z.infer<typeof registerBody>;
export type LocationInput = z.infer<typeof locationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileBody>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsBody>;
