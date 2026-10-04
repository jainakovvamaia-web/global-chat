// Регистрация, вход и выход через Supabase Auth.
// Пароли НЕ хранятся в нашей базе: их хэширует и хранит Supabase Auth (схема auth).
// Профиль (таблица profiles) создаёт триггер handle_new_user из user_metadata.

import type { Session } from "@supabase/supabase-js";
import { createAuthClient, supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import type { ProfileDto, SessionDto } from "../types/dto";
import { apiErrors } from "../utils/apiErrors";
import { check, must } from "../utils/db";
import type { RegisterInput } from "../validators/auth.validators";
import { assertValidLocation } from "./education.service";
import { getMyProfile, hasPassword } from "./user.service";

const toSession = (session: Session): SessionDto => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresAt: session.expires_at ?? null,
});

export interface AuthResult {
  session: SessionDto | null;
  profile: ProfileDto | null;
  needsEmailConfirmation: boolean;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  await assertValidLocation(input.location);

  const { data, error } = await createAuthClient().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${env.FRONTEND_URL}/auth/callback`,
      // Попадает в raw_user_meta_data → триггер создаёт профиль с городом, районом и заведением
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        city_id: input.location.cityId,
        district_id: input.location.districtId,
        institution_type: input.location.institutionType ?? "",
        institution_id: input.location.institutionId ?? "",
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      throw apiErrors.conflict("Этот email уже зарегистрирован", "EMAIL_TAKEN");
    }
    if (error.code === "weak_password") throw apiErrors.badRequest("Пароль слишком простой", "WEAK_PASSWORD");
    if (error.status === 429) throw apiErrors.tooManyRequests("Слишком много попыток — попробуйте позже");
    console.error("Ошибка регистрации Supabase:", error.message);
    throw apiErrors.internal("Не удалось зарегистрироваться");
  }

  // При включённом подтверждении email Supabase не сообщает, что адрес занят (защита от перебора):
  // он возвращает пользователя без identities. Сообщаем об этом честно.
  if (data.user && data.user.identities?.length === 0) {
    throw apiErrors.conflict("Этот email уже зарегистрирован", "EMAIL_TAKEN");
  }

  if (!data.session || !data.user) {
    return { session: null, profile: null, needsEmailConfirmation: true };
  }
  return { session: toSession(data.session), profile: await getMyProfile(data.user.id), needsEmailConfirmation: false };
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      throw apiErrors.forbidden("Подтвердите email — ссылка отправлена на почту", "EMAIL_NOT_CONFIRMED");
    }
    if (error.status === 429) throw apiErrors.tooManyRequests("Слишком много попыток — попробуйте позже");
    // Одинаковый ответ для «нет такого email» и «неверный пароль» — не раскрываем, кто зарегистрирован
    throw apiErrors.unauthorized("Неверный email или пароль", "INVALID_CREDENTIALS");
  }
  return {
    session: toSession(data.session),
    profile: await getMyProfile(data.user.id),
    needsEmailConfirmation: false,
  };
}

// Выход: токен отзывается на стороне Supabase — после этого им больше нельзя пользоваться
export async function logout(accessToken: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, "local");
  if (error) console.error("Ошибка выхода Supabase:", error.message);
}

// Письмо со ссылкой для нового пароля. Ответ всегда одинаковый — не раскрываем, есть ли такой email.
export async function forgotPassword(email: string): Promise<void> {
  const { error } = await createAuthClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${env.FRONTEND_URL}/auth/reset-password`,
  });
  if (error && error.status !== 429) console.error("Ошибка сброса пароля Supabase:", error.message);
}

// Смена пароля. Если пароль у аккаунта уже есть — сначала проверяем текущий:
// иначе любой, кто получил доступ к открытой сессии, мог бы забрать аккаунт.
// Аккаунт, созданный через Google, пароля не имеет — его можно просто задать.
export async function changePassword(
  userId: string,
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (await hasPassword(userId)) {
    if (!currentPassword) throw apiErrors.badRequest("Введите текущий пароль", "CURRENT_PASSWORD_REQUIRED");
    const verification = await createAuthClient().auth.signInWithPassword({ email, password: currentPassword });
    if (verification.error || !verification.data.session) {
      if (verification.error?.status === 429) throw apiErrors.tooManyRequests("Слишком много попыток — попробуйте позже");
      // 400, а не 401: 401 frontend понимает как «сессия истекла» и выходит из аккаунта
      throw apiErrors.badRequest("Текущий пароль неверный", "WRONG_PASSWORD");
    }
    // Проверочная сессия больше не нужна
    await supabaseAdmin.auth.admin.signOut(verification.data.session.access_token, "local");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
    app_metadata: { has_password: true }, // после этого и Google-аккаунту понадобится текущий пароль
  });
  if (error) {
    if (error.code === "same_password") throw apiErrors.badRequest("Новый пароль совпадает со старым", "SAME_PASSWORD");
    if (error.code === "weak_password") throw apiErrors.badRequest("Пароль слишком простой", "WEAK_PASSWORD");
    console.error("Ошибка смены пароля Supabase:", error.message);
    throw apiErrors.internal("Не удалось сменить пароль");
  }
}

// Удаление аккаунта: сообщения пользователя удаляются, затем пользователь Supabase Auth —
// профиль, участие в сообществах, реакции и уведомления удалит каскад в базе.
export async function deleteAccount(userId: string): Promise<void> {
  const owned = must(
    await supabaseAdmin
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId)
      .eq("role", "owner")
      .limit(1),
  );
  if (owned.length > 0) {
    throw apiErrors.conflict(
      "Вы владелец сообщества. Сначала удалите его в разделе «Администрирование»",
      "OWNER_CANNOT_DELETE",
    );
  }
  check(await supabaseAdmin.from("messages").delete().eq("user_id", userId));
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("Ошибка удаления пользователя Supabase:", error.message);
    throw apiErrors.internal("Не удалось удалить аккаунт");
  }
}
