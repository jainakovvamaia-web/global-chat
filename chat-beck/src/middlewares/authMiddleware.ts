// Проверка авторизации для защищённых маршрутов.
// Frontend отправляет заголовок "Authorization: Bearer <access_token>" — токен сессии Supabase Auth.
// Токен проверяется на стороне Supabase (supabase.auth.getUser), поэтому поддельный
// или отозванный (после выхода) токен не пройдёт. Тем же способом проверяется WebSocket.

import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { apiErrors } from "../utils/apiErrors";
import { touchLastSeen } from "../services/user.service";

// Проверка существующего access token Supabase. Одна функция и для REST, и для WebSocket —
// никакой отдельной системы токенов нет.
export async function verifyAccessToken(token: string): Promise<{ userId: string; email: string } | null> {
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  touchLastSeen(data.user.id); // статус «онлайн» — без ожидания, не замедляет запрос
  return { userId: data.user.id, email: data.user.email ?? "" };
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw apiErrors.unauthorized("Не авторизован", "NO_TOKEN");

  const user = await verifyAccessToken(token);
  if (!user) throw apiErrors.unauthorized("Сессия истекла — войдите снова", "INVALID_TOKEN");

  req.auth = { userId: user.userId, email: user.email, accessToken: token };
  next();
}

// Достаёт пользователя в контроллере защищённого маршрута
export function requireAuth(req: Request): NonNullable<Request["auth"]> {
  if (!req.auth) throw apiErrors.unauthorized("Не авторизован", "NO_TOKEN");
  return req.auth;
}
