// Единый обработчик ошибок. Express 5 сам передаёт сюда ошибки из async-обработчиков,
// поэтому отдельная обёртка asyncHandler не нужна.
//
// Исправлена ошибка прошлой версии: раньше для известной ошибки вызывались ДВА ответа подряд
// (res.status(...) и затем ещё res.status(500)) — Express падал с «headers already sent».
// Теперь ответ отправляется ровно один раз.

import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiErrors";

export const errorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }

  // Неверный JSON в теле запроса
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ message: "Неверный JSON в теле запроса", code: "INVALID_JSON" });
    return;
  }

  console.error("Необработанная ошибка:", err);
  res.status(500).json({ message: "Внутренняя ошибка сервера" });
};
