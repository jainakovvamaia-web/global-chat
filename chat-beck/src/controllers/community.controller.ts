import type { Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validate";
import * as aiService from "../services/ai.service";
import { listAudit } from "../services/audit.service";
import { requireCommunityRole, MODERATOR_ROLES } from "../services/access.service";
import * as channelService from "../services/channel.service";
import * as chatService from "../services/chat.service";
import * as communityService from "../services/community.service";
import * as eventService from "../services/event.service";
import { sendData, sendNoContent } from "../utils/response";
import { aiAskBody } from "../validators/chat.validators";
import {
  channelBody,
  communityParams,
  createCommunityBody,
  createInvitationBody,
  eventBody,
  invitationParams,
  joinByCodeBody,
  localChatBody,
  memberParams,
  setRoleBody,
  updateCommunityBody,
} from "../validators/community.validators";

const listQuery = z.object({
  joined: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  q: z.string().trim().max(100).optional(),
});

export async function list(req: Request, res: Response) {
  const filters = validate(listQuery, req.query);
  sendData(res, await communityService.listCommunities(requireAuth(req).userId, filters));
}

export async function get(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await communityService.getCommunity(requireAuth(req).userId, communityId));
}

export async function create(req: Request, res: Response) {
  const input = validate(createCommunityBody, req.body);
  sendData(res, await communityService.createCommunity(requireAuth(req).userId, input), 201);
}

export async function update(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  const input = validate(updateCommunityBody, req.body);
  sendData(res, await communityService.updateCommunity(requireAuth(req).userId, communityId, input));
}

export async function remove(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  await communityService.deleteCommunity(requireAuth(req).userId, communityId);
  sendNoContent(res);
}

export async function join(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await communityService.joinCommunity(requireAuth(req).userId, communityId));
}

export async function leave(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  await communityService.leaveCommunity(requireAuth(req).userId, communityId);
  sendNoContent(res);
}

export async function requestAccess(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await communityService.requestAccess(requireAuth(req).userId, communityId));
}

export async function joinByCode(req: Request, res: Response) {
  const { code } = validate(joinByCodeBody, req.body);
  sendData(res, await communityService.joinByCode(requireAuth(req).userId, code));
}

export async function joinRequests(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await communityService.listJoinRequests(requireAuth(req).userId, communityId));
}

const answerParams = z.object({ communityId: z.string(), requestId: z.string().regex(/^[a-f0-9]{24}$/) });
const answerBody = z.object({ approve: z.boolean() });

export async function answerJoinRequest(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  const { requestId } = validate(answerParams, req.params);
  const { approve } = validate(answerBody, req.body);
  await communityService.answerJoinRequest(requireAuth(req).userId, communityId, requestId, approve);
  sendNoContent(res);
}

export async function members(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await communityService.listMembers(requireAuth(req).userId, communityId));
}

export async function setMemberRole(req: Request, res: Response) {
  const { communityId, memberId } = validate(memberParams, req.params);
  const { role } = validate(setRoleBody, req.body);
  await communityService.setMemberRole(requireAuth(req).userId, communityId, memberId, role);
  sendNoContent(res);
}

export async function removeMember(req: Request, res: Response) {
  const { communityId, memberId } = validate(memberParams, req.params);
  await communityService.removeMember(requireAuth(req).userId, communityId, memberId);
  sendNoContent(res);
}

export async function createInvitation(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  const options = validate(createInvitationBody, req.body ?? {});
  sendData(res, await communityService.createInvitation(requireAuth(req).userId, communityId, options), 201);
}

export async function revokeInvitation(req: Request, res: Response) {
  const { communityId, code } = validate(invitationParams, req.params);
  await communityService.revokeInvitation(requireAuth(req).userId, communityId, code);
  sendNoContent(res);
}

export async function invitations(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await communityService.listInvitations(requireAuth(req).userId, communityId));
}

export async function auditLog(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  await requireCommunityRole(requireAuth(req).userId, communityId, MODERATOR_ROLES);
  sendData(res, await listAudit(communityId));
}

export async function stats(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await communityService.getStats(requireAuth(req).userId, communityId));
}

// ── Вложенные ресурсы: каналы, локальные чаты, события, AI ──────────────────

export async function channels(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await channelService.listChannels(requireAuth(req).userId, communityId));
}

export async function createChannel(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  const input = validate(channelBody, req.body);
  sendData(res, await channelService.createChannel(requireAuth(req).userId, communityId, input), 201);
}

export async function localChats(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await chatService.listLocalChats(requireAuth(req).userId, communityId));
}

export async function createLocalChat(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  const input = validate(localChatBody, req.body);
  sendData(res, await chatService.createLocalChat(requireAuth(req).userId, communityId, input), 201);
}

export async function events(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  sendData(res, await eventService.listEvents(requireAuth(req).userId, communityId));
}

export async function createEvent(req: Request, res: Response) {
  const { communityId } = validate(communityParams, req.params);
  const input = validate(eventBody, req.body);
  sendData(res, await eventService.createEvent(requireAuth(req).userId, communityId, input), 201);
}

export async function askAi(req: Request, res: Response) {
  const { communityId, question } = validate(aiAskBody, req.body);
  sendData(res, await aiService.ask(requireAuth(req).userId, communityId, question));
}
