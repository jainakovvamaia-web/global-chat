// Общее для приглашений в сообщества и группы: генерация кода, DTO и тексты ошибок входа по коду.

import { randomBytes } from "node:crypto";
import type { InvitationRow, RedeemStatus } from "../types/database.types";
import type { InvitationDto } from "../types/dto";
import { ApiError, apiErrors } from "./apiErrors";

// Без похожих символов 0/O и 1/I. 32 символа: остаток от деления байта на 32 распределён равномерно
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RANDOM_LENGTH = 10; // 32^10 ≈ 10^15 вариантов — перебрать нельзя (плюс лимит запросов)

const TRANSLIT: Record<string, string> = {
  а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z", и: "I", й: "Y", к: "K", л: "L",
  м: "M", н: "N", о: "O", п: "P", р: "R", с: "S", т: "T", у: "U", ф: "F", х: "H", ц: "C", ч: "CH", ш: "SH",
  щ: "SH", ы: "Y", э: "E", ю: "YU", я: "YA", ү: "U", ө: "O", ң: "N",
};

// Префикс по первому слову названия: «КНУ студенты» → «KNU», «Школа №61» → «SHKO»
function prefixFrom(name: string): string {
  const firstWord = name.trim().toLowerCase().split(/\s+/)[0] ?? "";
  const latin = Array.from(firstWord, (char) => TRANSLIT[char] ?? char.toUpperCase())
    .join("")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  return latin.length >= 2 ? latin : "GC";
}

// Криптографически случайный код вида «KNU-7F4X9QZ2KM»
export function generateInviteCode(name: string): string {
  const random = Array.from(randomBytes(RANDOM_LENGTH), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
  return `${prefixFrom(name)}-${random}`;
}

// Формат, который принимает база (CHECK invitations_code_format)
export const INVITE_CODE_PATTERN = /^([A-Z0-9]{2,6}-)?[A-Z0-9]{6,16}$/;

export function toInvitationDto(row: InvitationRow): InvitationDto {
  return {
    id: row.id,
    code: row.code,
    communityId: row.community_id,
    chatId: row.chat_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    usesCount: row.uses_count,
    isActive:
      row.is_active &&
      (row.expires_at === null || new Date(row.expires_at).getTime() > Date.now()) &&
      (row.max_uses === null || row.uses_count < row.max_uses),
  };
}

// Понятные ошибки для статусов redeem_invitation (кроме joined)
export function redeemError(status: Exclude<RedeemStatus, "joined">, kind: "chat" | "community"): ApiError {
  switch (status) {
    case "not_found":
      return apiErrors.notFound("Неверный код приглашения");
    case "revoked":
      return apiErrors.badRequest("Приглашение больше не действует", "INVITE_INACTIVE");
    case "expired":
      return apiErrors.badRequest("Срок действия приглашения истёк", "INVITE_EXPIRED");
    case "used_up":
      return apiErrors.badRequest("Лимит использований приглашения исчерпан", "INVITE_USED_UP");
    case "already_member":
      return apiErrors.conflict(
        kind === "chat" ? "Вы уже участник этой группы" : "Вы уже участник этого сообщества",
        "ALREADY_MEMBER",
      );
  }
}
