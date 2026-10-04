// Настройки нового кода приглашения: срок действия и число использований
import type { CreateInvitationInput } from "@/hooks/api/useInvitations";
import { formatFullDate } from "@/lib/format";
import type { Invitation } from "@/types";

export const EXPIRY_OPTIONS = [
  { value: "24h", label: "24 часа" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "never", label: "Бессрочно" },
] as const;

export const MAX_USES_OPTIONS = [
  { value: "1", label: "Одноразовый (1 человек)" },
  { value: "10", label: "До 10 человек" },
  { value: "50", label: "До 50 человек" },
  { value: "unlimited", label: "Без ограничения" },
] as const;

export type ExpiryValue = (typeof EXPIRY_OPTIONS)[number]["value"];
export type MaxUsesValue = (typeof MAX_USES_OPTIONS)[number]["value"];

const EXPIRY_MS: Record<Exclude<ExpiryValue, "never">, number> = {
  "24h": 24 * 3_600_000,
  "7d": 7 * 86_400_000,
  "30d": 30 * 86_400_000,
};

export function toInvitationInput(expiry: ExpiryValue, maxUses: MaxUsesValue): CreateInvitationInput {
  return {
    expiresAt: expiry === "never" ? null : new Date(Date.now() + EXPIRY_MS[expiry]).toISOString(),
    maxUses: maxUses === "unlimited" ? null : Number(maxUses),
  };
}

// «до 12 октября · 3 / 10 использований» и почему код не работает, если он неактивен
export function describeInvitation(invitation: Invitation): { meta: string; status: string | null } {
  const expires = invitation.expiresAt ? `до ${formatFullDate(invitation.expiresAt)}` : "бессрочно";
  const uses =
    invitation.maxUses === null
      ? `использован ${invitation.usesCount} раз`
      : `${invitation.usesCount} / ${invitation.maxUses} использований`;
  let status: string | null = null;
  if (!invitation.isActive) {
    if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now()) status = "истёк";
    else if (invitation.maxUses !== null && invitation.usesCount >= invitation.maxUses) status = "исчерпан";
    else status = "отключён";
  }
  return { meta: `${expires} · ${uses}`, status };
}
