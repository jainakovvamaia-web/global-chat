// Единый формат успешного ответа: { data: ... }. Ошибки: { message, code } (см. errorHandler).

import type { Response } from "express";

export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
