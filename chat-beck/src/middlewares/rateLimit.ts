// Ограничение частоты запросов (защита от спама и перебора паролей, ТЗ п. 11)

import type { Request } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const tooMany = { message: "Слишком много запросов — попробуйте чуть позже", code: "RATE_LIMITED" };

// Общий лимит на все запросы с одного IP
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany,
});

// Вход, регистрация, восстановление пароля — строже (перебор паролей)
export const authLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany,
});

// Отправка сообщений — по пользователю, а не по IP (защита от массовой рассылки)
export const messageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ""),
  message: { ...tooMany, message: "Вы отправляете сообщения слишком часто" },
});

// Вход по коду приглашения — по пользователю: не даём перебирать коды
export const inviteJoinLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? ""),
  message: { ...tooMany, message: "Слишком много попыток ввести код — попробуйте через 10 минут" },
});
