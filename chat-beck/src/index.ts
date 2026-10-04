import { createServer } from "node:http";
import { getAllowedOrigins, reportRejectedOrigin } from "./config/cors";
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
  allowedOrigins: getAllowedOrigins(),
  onRejectedOrigin: (origin) => reportRejectedOrigin(origin, "ws"),
});

server.listen(env.PORT, () => {
  console.log(`API запущен на порту ${env.PORT}: /api (локально http://localhost:${env.PORT}/api)`);
  console.log(`WebSocket: ${WEBSOCKET_PATH} (локально ws://localhost:${env.PORT}${WEBSOCKET_PATH})`);
  console.log(`Разрешённые адреса сайта: ${getAllowedOrigins().join(", ")}`);
});
