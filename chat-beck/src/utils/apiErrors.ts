// «Человеческие» ошибки API. Сервис делает throw apiErrors.notFound("..."),
// а errorHandler превращает ошибку в ответ { message, code } с нужным HTTP-статусом.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const apiErrors = {
  // 400 — неверные данные в запросе
  badRequest: (message: string, code?: string) => new ApiError(400, message, code),
  // 401 — не авторизован: нет токена, токен истёк, неверный пароль
  unauthorized: (message: string, code?: string) => new ApiError(401, message, code),
  // 403 — авторизован, но действие запрещено (нет прав)
  forbidden: (message: string, code?: string) => new ApiError(403, message, code),
  // 404 — не найдено (или нет доступа — чтобы не раскрывать, что объект существует)
  notFound: (message: string) => new ApiError(404, message),
  // 409 — конфликт (например, email уже зарегистрирован)
  conflict: (message: string, code?: string) => new ApiError(409, message, code),
  // 429 — слишком много запросов
  tooManyRequests: (message: string) => new ApiError(429, message, "RATE_LIMITED"),
  // 500 — внутренняя ошибка (подробности только в логе сервера)
  internal: (message = "Внутренняя ошибка сервера") => new ApiError(500, message),
};
