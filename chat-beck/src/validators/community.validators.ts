import { z } from "zod";
import { INVITE_CODE_PATTERN } from "../utils/invitations";
import { emojiSchema, slugId, uuidId } from "./common.validators";

export const communityParams = z.object({ communityId: slugId });
export const memberParams = z.object({ communityId: slugId, memberId: z.string().regex(/^[a-f0-9]{24}$/) });

export const createCommunityBody = z.object({
  name: z.string().trim().min(2, "Название — минимум 2 символа").max(100),
  category: z.enum(["school", "university", "residential", "district", "company"]),
  description: z.string().trim().max(500).default(""),
  emoji: emojiSchema.default("🏘️"),
  isPrivate: z.boolean().default(false),
});

export const updateCommunityBody = createCommunityBody.partial();

export const joinByCodeBody = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(INVITE_CODE_PATTERN, "Неверный код приглашения"),
});

// Новый код приглашения: срок в днях (null — бессрочно) и лимит использований (null — без лимита)
export const createInvitationBody = z
  .object({
    expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
    maxUses: z.number().int().min(1).max(10_000).nullable().optional(),
  })
  .default({});

export const invitationParams = z.object({
  communityId: slugId,
  code: z.string().trim().toUpperCase().regex(INVITE_CODE_PATTERN, "Неверный код приглашения"),
});

export const setRoleBody = z.object({ role: z.enum(["admin", "moderator", "member"]) });

// Имя канала как в адресе: строчные буквы, цифры, дефисы; «place» занят чатами по месту
export const channelBody = z.object({
  name: z
    .string()
    .trim()
    .transform((value) =>
      value.toLowerCase().replace(/^#/, "").replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, ""),
    )
    .pipe(
      z
        .string()
        .min(1, "Введите название канала")
        .max(50)
        .refine((value) => value !== "place", "Название #place зарезервировано"),
    ),
  description: z.string().trim().max(300).default(""),
  emoji: emojiSchema.default("💬"),
  isAnnouncements: z.boolean().default(false),
  isPinned: z.boolean().optional(),
});

export const channelParams = z.object({ channelId: uuidId });

export const localChatBody = z.object({
  name: z.string().trim().min(2, "Название — минимум 2 символа").max(100),
  description: z.string().trim().max(300).default(""),
  emoji: emojiSchema.default("📍"),
  access: z.enum(["public", "private"]).default("public"),
});

export const eventBody = z.object({
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(2000).default(""),
  emoji: emojiSchema.default("🎉"),
  startsAt: z.iso.datetime({ offset: true, message: "Неверная дата" }),
  location: z.string().trim().min(1, "Укажите место").max(200),
  maxAttendees: z.number().int().min(2).max(100000).nullable().default(null),
});

export const eventParams = z.object({ eventId: uuidId });

export type CreateCommunityInput = z.infer<typeof createCommunityBody>;
export type UpdateCommunityInput = z.infer<typeof updateCommunityBody>;
export type ChannelInput = z.infer<typeof channelBody>;
export type LocalChatInput = z.infer<typeof localChatBody>;
export type EventInput = z.infer<typeof eventBody>;
