// Приглашения в группы: создание, вход по коду, отключение
import { z } from "zod";
import { INVITE_CODE_PATTERN } from "../utils/invitations";
import { uuidId } from "./common.validators";

const YEAR_MS = 365 * 86_400_000;

// expiresAt — когда код перестанет работать (null — бессрочно), maxUses — сколько раз им можно
// воспользоваться (1 — одноразовый, null — без ограничения)
export const createChatInvitationBody = z
  .object({
    expiresAt: z.iso
      .datetime({ offset: true, message: "Неверная дата окончания" })
      .refine((value) => Date.parse(value) > Date.now(), "Дата окончания уже прошла")
      .refine((value) => Date.parse(value) < Date.now() + YEAR_MS, "Срок — не больше года")
      .nullable()
      .optional(),
    maxUses: z.number().int().min(1, "Минимум 1 использование").max(10_000).nullable().optional(),
  })
  .default({});

export const joinByInvitationBody = z.object({
  code: z.string().trim().toUpperCase().regex(INVITE_CODE_PATTERN, "Неверный код приглашения"),
});

export const invitationIdParams = z.object({ invitationId: uuidId });

export type CreateChatInvitationInput = z.infer<typeof createChatInvitationBody>;
