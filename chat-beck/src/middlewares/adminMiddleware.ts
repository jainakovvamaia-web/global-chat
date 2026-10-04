// Только для администратора платформы. Роль читается из базы (profiles.role) при каждом запросе —
// не из токена, тела запроса или параметров, поэтому подделать её с frontend нельзя.
// Сервисы проверяют роль ещё раз: middleware — первая линия, а не единственная.

import type { NextFunction, Request, Response } from "express";
import { isPlatformAdmin } from "../services/user.service";
import { apiErrors } from "../utils/apiErrors";
import { requireAuth } from "./authMiddleware";

export function adminOnly(message = "Это действие доступно только администраторам") {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!(await isPlatformAdmin(requireAuth(req).userId))) throw apiErrors.forbidden(message, "ADMIN_ONLY");
    next();
  };
}

// Поля, которыми клиент мог бы попытаться выдать себе права. Их нельзя передавать ни при
// регистрации, ни при изменении профиля — запрос отклоняется целиком (403), а не «молча» игнорируется.
const FORBIDDEN_FIELDS = ["role", "isAdmin", "is_admin", "admin"];

export function rejectRoleFields(body: unknown): void {
  if (typeof body !== "object" || body === null) return;
  if (FORBIDDEN_FIELDS.some((field) => field in body)) {
    throw apiErrors.forbidden("Роль пользователя нельзя задать или изменить через профиль", "ROLE_CHANGE_FORBIDDEN");
  }
}
