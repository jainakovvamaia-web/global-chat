// Чаты, каналы, сообщения, события, уведомления, поиск

import type { Request, Response } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validate";
import * as channelService from "../services/channel.service";
import * as chatService from "../services/chat.service";
import * as eventService from "../services/event.service";
import * as messageService from "../services/message.service";
import * as notificationService from "../services/notification.service";
import * as searchService from "../services/search.service";
import { sendData, sendNoContent } from "../utils/response";
import {
  chatParams,
  createChatBody,
  editMessageBody,
  messageParams,
  messagesQuery,
  reactionBody,
  searchQuery,
  sendMessageBody,
  updateChatBody,
} from "../validators/chat.validators";
import { uuidParams } from "../validators/common.validators";
import { channelBody, channelParams, eventParams } from "../validators/community.validators";

// ── Чаты ─────────────────────────────────────────────────────────────────────

export async function availableChats(req: Request, res: Response) {
  sendData(res, await chatService.listAvailableChats(requireAuth(req).userId));
}

export async function getChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  sendData(res, await chatService.getChat(requireAuth(req).userId, chatId));
}

export async function createChat(req: Request, res: Response) {
  const input = validate(createChatBody, req.body);
  sendData(res, await chatService.createChat(requireAuth(req).userId, input), 201);
}

export async function updateChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  const input = validate(updateChatBody, req.body);
  sendData(res, await chatService.updateChat(requireAuth(req).userId, chatId, input));
}

export async function deleteChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  await chatService.deleteChat(requireAuth(req).userId, chatId);
  sendNoContent(res);
}

export async function getLocalChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  sendData(res, await chatService.getLocalChat(requireAuth(req).userId, chatId));
}

export async function joinChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  sendData(res, await chatService.joinLocalChat(requireAuth(req).userId, chatId));
}

export async function leaveChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  sendData(res, await chatService.leaveChat(requireAuth(req).userId, chatId));
}

export async function deleteLocalChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  await chatService.deleteLocalChat(requireAuth(req).userId, chatId);
  sendNoContent(res);
}

// ── Каналы ───────────────────────────────────────────────────────────────────

export async function updateChannel(req: Request, res: Response) {
  const { channelId } = validate(channelParams, req.params);
  const input = validate(channelBody, req.body);
  sendData(res, await channelService.updateChannel(requireAuth(req).userId, channelId, input));
}

export async function deleteChannel(req: Request, res: Response) {
  const { channelId } = validate(channelParams, req.params);
  await channelService.deleteChannel(requireAuth(req).userId, channelId);
  sendNoContent(res);
}

export async function markChannelRead(req: Request, res: Response) {
  const { channelId } = validate(channelParams, req.params);
  await channelService.markChannelRead(requireAuth(req).userId, channelId);
  sendNoContent(res);
}

// ── Сообщения ────────────────────────────────────────────────────────────────

export async function chatMessages(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  const query = validate(messagesQuery, req.query);
  sendData(res, await messageService.listMessages(requireAuth(req).userId, { kind: "chat", id: chatId }, query));
}

export async function sendChatMessage(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  const input = validate(sendMessageBody, req.body);
  sendData(res, await messageService.sendMessage(requireAuth(req).userId, { kind: "chat", id: chatId }, input), 201);
}

export async function channelMessages(req: Request, res: Response) {
  const { channelId } = validate(channelParams, req.params);
  const query = validate(messagesQuery, req.query);
  sendData(res, await messageService.listMessages(requireAuth(req).userId, { kind: "channel", id: channelId }, query));
}

export async function sendChannelMessage(req: Request, res: Response) {
  const { channelId } = validate(channelParams, req.params);
  const input = validate(sendMessageBody, req.body);
  sendData(
    res,
    await messageService.sendMessage(requireAuth(req).userId, { kind: "channel", id: channelId }, input),
    201,
  );
}

export async function getMessage(req: Request, res: Response) {
  const { messageId } = validate(messageParams, req.params);
  sendData(res, await messageService.getMessageDto(requireAuth(req).userId, messageId));
}

export async function editMessage(req: Request, res: Response) {
  const { messageId } = validate(messageParams, req.params);
  const { content } = validate(editMessageBody, req.body);
  sendData(res, await messageService.updateMessage(requireAuth(req).userId, messageId, content));
}

export async function deleteMessage(req: Request, res: Response) {
  const { messageId } = validate(messageParams, req.params);
  await messageService.deleteMessage(requireAuth(req).userId, messageId);
  sendNoContent(res);
}

export async function toggleReaction(req: Request, res: Response) {
  const { messageId } = validate(messageParams, req.params);
  const { emoji } = validate(reactionBody, req.body);
  sendData(res, await messageService.toggleReaction(requireAuth(req).userId, messageId, emoji));
}

// ── События ──────────────────────────────────────────────────────────────────

export async function getEvent(req: Request, res: Response) {
  const { eventId } = validate(eventParams, req.params);
  sendData(res, await eventService.getEvent(requireAuth(req).userId, eventId));
}

export async function deleteEvent(req: Request, res: Response) {
  const { eventId } = validate(eventParams, req.params);
  await eventService.deleteEvent(requireAuth(req).userId, eventId);
  sendNoContent(res);
}

export async function joinEvent(req: Request, res: Response) {
  const { eventId } = validate(eventParams, req.params);
  sendData(res, await eventService.joinEvent(requireAuth(req).userId, eventId));
}

export async function leaveEvent(req: Request, res: Response) {
  const { eventId } = validate(eventParams, req.params);
  sendData(res, await eventService.leaveEvent(requireAuth(req).userId, eventId));
}

// ── Уведомления и поиск ──────────────────────────────────────────────────────

export async function notifications(req: Request, res: Response) {
  sendData(res, await notificationService.listNotifications(requireAuth(req).userId));
}

export async function markNotificationRead(req: Request, res: Response) {
  const { id } = validate(uuidParams, req.params);
  await notificationService.markRead(requireAuth(req).userId, id);
  sendNoContent(res);
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  await notificationService.markAllRead(requireAuth(req).userId);
  sendNoContent(res);
}

export async function search(req: Request, res: Response) {
  const { q } = validate(searchQuery, req.query);
  sendData(res, await searchService.search(requireAuth(req).userId, q));
}
