// Все маршруты API. Цепочка: Route → (middleware) → Controller → Service → Supabase.
// Всё, кроме регистрации/входа и справочников, требует авторизации (authMiddleware).

import { Router } from "express";
import * as auth from "../controllers/auth.controller";
import * as chat from "../controllers/chat.controller";
import * as community from "../controllers/community.controller";
import * as education from "../controllers/education.controller";
import * as invitation from "../controllers/invitation.controller";
import { adminOnly } from "../middlewares/adminMiddleware";
import { authMiddleware } from "../middlewares/authMiddleware";
import { authLimiter, inviteJoinLimiter, messageLimiter } from "../middlewares/rateLimit";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ data: { status: "ok" } });
});

// ── Auth ─────────────────────────────────────────────────────────────────────
apiRouter.post("/auth/register", authLimiter, auth.register);
apiRouter.post("/auth/login", authLimiter, auth.login);
apiRouter.post("/auth/forgot-password", authLimiter, auth.forgotPassword);
apiRouter.post("/auth/logout", authMiddleware, auth.logout);
apiRouter.get("/auth/me", authMiddleware, auth.me);
apiRouter.get("/auth/profile", authMiddleware, auth.me);
apiRouter.patch("/auth/profile", authMiddleware, auth.updateProfile);
apiRouter.patch("/auth/password", authMiddleware, authLimiter, auth.changePassword);
apiRouter.delete("/auth/account", authMiddleware, authLimiter, auth.deleteAccount);
apiRouter.get("/auth/stats", authMiddleware, auth.stats);
apiRouter.get("/auth/settings", authMiddleware, auth.getSettings);
apiRouter.patch("/auth/settings", authMiddleware, auth.updateSettings);

// ── Справочники (открыты: нужны на странице регистрации) ─────────────────────
apiRouter.get("/education/cities", education.cities);
apiRouter.get("/education/cities/:cityId/districts", education.cityDistricts);
apiRouter.get("/education/districts", education.districts);
apiRouter.get("/education/institutions", education.institutions);

// Дальше — только для вошедших. Проверка токена подключена к своим разделам API,
// поэтому неизвестный адрес получает 404, а не «Не авторизован».
const SECURED_PATHS = [
  "/communities",
  "/channels",
  "/chats",
  "/local-chats",
  "/messages",
  "/events",
  "/notifications",
  "/search",
  "/ai",
  "/invitations",
];
apiRouter.use(SECURED_PATHS, authMiddleware);
const secured = Router();
apiRouter.use(secured);

// ── Сообщества ───────────────────────────────────────────────────────────────
secured.get("/communities", community.list);
secured.post("/communities", adminOnly("Создавать сообщества могут только администраторы"), community.create);
secured.post("/communities/join-by-code", inviteJoinLimiter, community.joinByCode);
secured.get("/communities/:communityId", community.get);
secured.patch("/communities/:communityId", community.update);
secured.delete("/communities/:communityId", community.remove);
secured.post("/communities/:communityId/join", community.join);
secured.post("/communities/:communityId/leave", community.leave);
secured.post("/communities/:communityId/request-access", community.requestAccess);
secured.get("/communities/:communityId/join-requests", community.joinRequests);
secured.post("/communities/:communityId/join-requests/:requestId", community.answerJoinRequest);
secured.get("/communities/:communityId/members", community.members);
secured.patch("/communities/:communityId/members/:memberId", community.setMemberRole);
secured.delete("/communities/:communityId/members/:memberId", community.removeMember);
secured.get("/communities/:communityId/invitations", community.invitations);
secured.post("/communities/:communityId/invitations", community.createInvitation);
secured.delete("/communities/:communityId/invitations/:code", community.revokeInvitation);
secured.get("/communities/:communityId/audit-log", community.auditLog);
secured.get("/communities/:communityId/stats", community.stats);
secured.get("/communities/:communityId/channels", community.channels);
secured.post("/communities/:communityId/channels", community.createChannel);
secured.get("/communities/:communityId/local-chats", community.localChats);
secured.post("/communities/:communityId/local-chats", community.createLocalChat);
secured.get("/communities/:communityId/events", community.events);
secured.post("/communities/:communityId/events", community.createEvent);

// ── Каналы ───────────────────────────────────────────────────────────────────
secured.patch("/channels/:channelId", chat.updateChannel);
secured.delete("/channels/:channelId", chat.deleteChannel);
secured.post("/channels/:channelId/read", chat.markChannelRead);
secured.get("/channels/:channelId/messages", chat.channelMessages);
secured.post("/channels/:channelId/messages", messageLimiter, chat.sendChannelMessage);

// ── Чаты (по месту и локальные) ──────────────────────────────────────────────
secured.get("/chats", chat.availableChats);
// Только admin платформы: роль из базы проверяет middleware и ещё раз сервис
secured.post("/chats", adminOnly("Создавать группы могут только администраторы"), chat.createChat);
secured.get("/chats/:chatId", chat.getChat);
secured.patch("/chats/:chatId", chat.updateChat);
secured.delete("/chats/:chatId", chat.deleteChat);
secured.get("/local-chats/:chatId", chat.getLocalChat);
secured.delete("/local-chats/:chatId", chat.deleteLocalChat);
secured.post("/chats/:chatId/join", chat.joinChat);
secured.post("/chats/:chatId/leave", chat.leaveChat);
secured.get("/chats/:chatId/messages", chat.chatMessages);
secured.get("/chats/:chatId/invitations", invitation.listForChat); // создатель группы или admin
secured.post("/chats/:chatId/invitations", invitation.createForChat); // создатель группы или admin
secured.post("/chats/:chatId/messages", messageLimiter, chat.sendChatMessage);

// ── Приглашения ──────────────────────────────────────────────────────────────
secured.post("/invitations/join", inviteJoinLimiter, invitation.join);
secured.post("/invitations/:invitationId/deactivate", invitation.deactivate);

// ── Сообщения ────────────────────────────────────────────────────────────────
secured.get("/messages/:messageId", chat.getMessage);
secured.patch("/messages/:messageId", chat.editMessage);
secured.delete("/messages/:messageId", chat.deleteMessage);
secured.post("/messages/:messageId/reactions", chat.toggleReaction);

// ── События ──────────────────────────────────────────────────────────────────
secured.get("/events/:eventId", chat.getEvent);
secured.delete("/events/:eventId", chat.deleteEvent);
secured.post("/events/:eventId/participation", chat.joinEvent);
secured.delete("/events/:eventId/participation", chat.leaveEvent);

// ── Уведомления, поиск, AI ───────────────────────────────────────────────────
secured.get("/notifications", chat.notifications);
secured.post("/notifications/read-all", chat.markAllNotificationsRead);
secured.post("/notifications/:id/read", chat.markNotificationRead);
secured.get("/search", chat.search);
secured.post("/ai/ask", messageLimiter, community.askAi);
