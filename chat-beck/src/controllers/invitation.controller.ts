// Приглашения в группы и вход по коду. Контроллер только проверяет данные (zod) и вызывает сервис.

import type { Request, Response } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validate";
import * as invitationService from "../services/invitation.service";
import { sendData } from "../utils/response";
import { chatParams } from "../validators/chat.validators";
import {
  createChatInvitationBody,
  invitationIdParams,
  joinByInvitationBody,
} from "../validators/invitation.validators";

export async function listForChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  sendData(res, await invitationService.listChatInvitations(requireAuth(req).userId, chatId));
}

export async function createForChat(req: Request, res: Response) {
  const { chatId } = validate(chatParams, req.params);
  const input = validate(createChatInvitationBody, req.body ?? {});
  sendData(res, await invitationService.createChatInvitation(requireAuth(req).userId, chatId, input), 201);
}

export async function deactivate(req: Request, res: Response) {
  const { invitationId } = validate(invitationIdParams, req.params);
  sendData(res, await invitationService.deactivateInvitation(requireAuth(req).userId, invitationId));
}

export async function join(req: Request, res: Response) {
  const { code } = validate(joinByInvitationBody, req.body);
  sendData(res, await invitationService.joinByInvitation(requireAuth(req).userId, code));
}
