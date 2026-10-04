// Профиль и настройки текущего пользователя. Чужие профили API не отдаёт вообще.

import { supabaseAdmin } from "../config/supabase";
import type { ProfileRow } from "../types/database.types";
import type { MyStatsDto, ProfileDto, SettingsDto } from "../types/dto";
import { apiErrors } from "../utils/apiErrors";
import { check, escapeLike, must } from "../utils/db";
import type { UpdateProfileInput, UpdateSettingsInput } from "../validators/auth.validators";
import { assertValidLocation, getLocationNames } from "./education.service";

// ── «Онлайн» ─────────────────────────────────────────────────────────────────
// last_seen_at обновляется не чаще раза в минуту на пользователя — не нагружаем базу
// на каждый запрос. Онлайн = заходил в последние 5 минут (см. community_counts в SQL).
const TOUCH_INTERVAL_MS = 60_000;
const lastTouched = new Map<string, number>();

export function touchLastSeen(userId: string): void {
  const now = Date.now();
  if (now - (lastTouched.get(userId) ?? 0) < TOUCH_INTERVAL_MS) return;
  lastTouched.set(userId, now);
  // Таблица не растёт бесконечно: давние записи больше не нужны для ограничения частоты
  if (lastTouched.size > 10_000) {
    for (const [id, touchedAt] of lastTouched) {
      if (now - touchedAt >= TOUCH_INTERVAL_MS) lastTouched.delete(id);
    }
  }
  void supabaseAdmin
    .from("profiles")
    .update({ last_seen_at: new Date(now).toISOString() })
    .eq("id", userId)
    .then(({ error }) => {
      if (error) console.error("Не удалось обновить last_seen_at:", error.message);
    });
}

// Онлайн = заходил в последние 5 минут и разрешил показывать статус (как is_visible_online в SQL)
export const isOnline = (lastSeenAt: string | null, settings: Record<string, unknown> = {}) =>
  lastSeenAt !== null &&
  Date.now() - new Date(lastSeenAt).getTime() < 5 * 60_000 &&
  readSettings(settings).privacy.whoSeesOnline === "Все";

// ── Профиль ──────────────────────────────────────────────────────────────────

export async function getProfileRow(userId: string): Promise<ProfileRow> {
  return must(
    await supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    "Профиль не найден",
  );
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const row = must(await supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle());
  return row.role === "admin";
}

// Есть ли у аккаунта пароль: вход по email или пароль, заданный после входа через Google
export async function hasPassword(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) return true; // при сбое требуем текущий пароль — так безопаснее
  const providers = data.user.app_metadata["providers"];
  return (
    (Array.isArray(providers) && providers.includes("email")) ||
    data.user.identities?.some((identity) => identity.provider === "email") === true ||
    data.user.app_metadata["has_password"] === true
  );
}

export async function toProfileDto(row: ProfileRow): Promise<ProfileDto> {
  const [locationNames, passwordSet] = await Promise.all([getLocationNames(row), hasPassword(row.id)]);
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username ?? "",
    email: row.email,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    role: row.role,
    joinedAt: row.created_at,
    location: {
      cityId: row.city_id,
      districtId: row.district_id,
      institutionType: row.institution_type,
      institutionId: row.institution_id,
    },
    locationNames,
    isProfileComplete: row.city_id !== null && row.district_id !== null,
    hasPassword: passwordSet,
  };
}

export async function getMyProfile(userId: string): Promise<ProfileDto> {
  return toProfileDto(await getProfileRow(userId));
}

export async function updateMyProfile(userId: string, input: UpdateProfileInput): Promise<ProfileDto> {
  const patch: Partial<ProfileRow> = {};
  if (input.firstName !== undefined) patch.first_name = input.firstName;
  if (input.lastName !== undefined) patch.last_name = input.lastName;
  if (input.bio !== undefined) patch.bio = input.bio;

  if (input.username !== undefined) {
    const taken = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .ilike("username", escapeLike(input.username)) // без учёта регистра, «_» — обычный символ
      .neq("id", userId);
    if ((taken.count ?? 0) > 0) throw apiErrors.conflict("Это имя пользователя уже занято", "USERNAME_TAKEN");
    patch.username = input.username;
  }

  if (input.location) {
    await assertValidLocation(input.location);
    patch.city_id = input.location.cityId;
    patch.district_id = input.location.districtId;
    patch.institution_type = input.location.institutionType;
    patch.institution_id = input.location.institutionId;
  }

  const row = must(await supabaseAdmin.from("profiles").update(patch).eq("id", userId).select("*").maybeSingle());

  // Новый город — вступаем в открытые сообщества этого города (чаты по месту пересчитает сама база)
  if (input.location) check(await supabaseAdmin.rpc("join_city_communities", { p_user: userId }));

  return toProfileDto(row);
}

// Сколько я написал сообщений, в скольких событиях и сообществах участвую
export async function getMyStats(userId: string): Promise<MyStatsDto> {
  const [row] = must(await supabaseAdmin.rpc("user_stats", { p_user: userId }));
  return { messages: row?.messages ?? 0, events: row?.events ?? 0, communities: row?.communities ?? 0 };
}

// ── Настройки (хранятся в profiles.settings) ────────────────────────────────

// Допустимые значения приватности (такие же списки показывает frontend)
export const PRIVACY_OPTIONS = {
  whoCanMessage: ["Все", "Только участники сообщества", "Никто"],
  whoSeesOnline: ["Все", "Только друзья", "Никто"],
} as const;

const DEFAULT_SETTINGS: SettingsDto = {
  notifications: { messages: true, mentions: true, replies: true, announcements: true, events: false },
  privacy: { whoCanMessage: "Все", whoSeesOnline: "Все" },
  theme: "light",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Сохранённые настройки поверх значений по умолчанию; лишние и неверные поля отбрасываются
export function readSettings(raw: Record<string, unknown>): SettingsDto {
  const result: SettingsDto = structuredClone(DEFAULT_SETTINGS);
  const notifications = raw["notifications"];
  if (isRecord(notifications)) {
    for (const key of Object.keys(result.notifications) as (keyof SettingsDto["notifications"])[]) {
      const value = notifications[key];
      if (typeof value === "boolean") result.notifications[key] = value;
    }
  }
  const privacy = raw["privacy"];
  if (isRecord(privacy)) {
    for (const key of Object.keys(result.privacy) as (keyof SettingsDto["privacy"])[]) {
      const value = privacy[key];
      if (typeof value === "string" && (PRIVACY_OPTIONS[key] as readonly string[]).includes(value)) {
        result.privacy[key] = value;
      }
    }
  }
  const theme = raw["theme"];
  if (theme === "light" || theme === "dark" || theme === "system") result.theme = theme;
  return result;
}

export async function getSettings(userId: string): Promise<SettingsDto> {
  const row = must(await supabaseAdmin.from("profiles").select("settings").eq("id", userId).maybeSingle());
  return readSettings(row.settings);
}

export async function updateSettings(userId: string, input: UpdateSettingsInput): Promise<SettingsDto> {
  const current = await getSettings(userId);
  const next: SettingsDto = {
    notifications: { ...current.notifications, ...stripUndefined(input.notifications) },
    privacy: { ...current.privacy, ...stripUndefined(input.privacy) },
    theme: input.theme ?? current.theme,
  };
  check(await supabaseAdmin.from("profiles").update({ settings: next }).eq("id", userId));
  return next;
}

function stripUndefined<T extends object>(value: T | undefined): Partial<{ [K in keyof T]: Exclude<T[K], undefined> }> {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<{
    [K in keyof T]: Exclude<T[K], undefined>;
  }>;
}
