import cors from "cors";
import express from "express";
import { corsOptions } from "./config/cors";
import { errorHandler } from "./middlewares/errorHandler";
import { apiLimiter } from "./middlewares/rateLimit";
import { apiRouter } from "./routes";
import { apiErrors } from "./utils/apiErrors";

const createApi = () => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // правильный IP клиента за прокси (для rate limit)

  // CORS — самым первым: preflight (OPTIONS) получает ответ 204 с заголовками ещё до
  // rate limit, разбора JSON и маршрутов. Адреса — из FRONTEND_URL (локальный и/или Vercel).
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "100kb" }));
  app.use("/api", apiLimiter, apiRouter);

  // Неизвестный адрес — 404 в том же формате, что и остальные ошибки
  app.use(() => {
    throw apiErrors.notFound("Такого адреса API нет");
  });
  app.use(errorHandler);

  return app;
};

export default createApi;
