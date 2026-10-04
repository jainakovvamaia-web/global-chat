import { createServer } from "node:http";
import { env } from "./config/env";
import createApi from "./createApi";
import { verifyAccessToken } from "./middlewares/authMiddleware";
import { realtimeHub } from "./realtime/realtime.service";
import { attachWebSocket, WEBSOCKET_PATH } from "./realtime/websocket.server";

const app = createApi();

// Один HTTP-сервер и один порт: REST API (/api) и WebSocket (/ws)
const server = createServer(app);

attachWebSocket(server, {
  hub: realtimeHub,
  verifyToken: verifyAccessToken,
  allowedOrigins: env.FRONTEND_ORIGINS,
});

server.listen(env.PORT, () => {
  console.log(`API запущен на порту ${env.PORT}: /api (локально http://localhost:${env.PORT}/api)`);
  console.log(`WebSocket: ${WEBSOCKET_PATH} (локально ws://localhost:${env.PORT}${WEBSOCKET_PATH})`);
  console.log(`Разрешённые адреса сайта: ${env.FRONTEND_ORIGINS.join(", ")}`);
});
