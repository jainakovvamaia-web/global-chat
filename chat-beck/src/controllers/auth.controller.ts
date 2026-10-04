// Контроллер: достаёт данные из запроса, проверяет их (zod) и вызывает сервис. Логики здесь нет.

import type { Request, Response } from "express";
import { rejectRoleFields } from "../middlewares/adminMiddleware";
import { revalidateAccess } from "../realtime/realtime.service";
import { requireAuth } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validate";
import * as authService from "../services/auth.service";
import * as userService from "../services/user.service";
import { sendData, sendNoContent } from "../utils/response";
import {
  changePasswordBody,
  forgotPasswordBody,
  loginBody,
  registerBody,
  updateProfileBody,
  updateSettingsBody,
} from "../validators/auth.validators";

export async function register(req: Request, res: Response) {
  rejectRoleFields(req.body); // при регистрации роль всегда user — её ставит база
  const input = validate(registerBody, req.body);
  sendData(res, await authService.register(input), 201);
}

export async function login(req: Request, res: Response) {
  const { email, password } = validate(loginBody, req.body);
  sendData(res, await authService.login(email, password));
}

export async function logout(req: Request, res: Response) {
  await authService.logout(requireAuth(req).accessToken);
  sendNoContent(res);
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = validate(forgotPasswordBody, req.body);
  await authService.forgotPassword(email);
  sendData(res, { message: "Если такой email зарегистрирован, мы отправили на него ссылку" });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = validate(changePasswordBody, req.body);
  const { userId, email } = requireAuth(req);
  await authService.changePassword(userId, email, currentPassword, newPassword);
  sendNoContent(res);
}

export async function deleteAccount(req: Request, res: Response) {
  const { userId } = requireAuth(req);
  await authService.deleteAccount(userId);
  revalidateAccess(userId);
  sendNoContent(res);
}

export async function stats(req: Request, res: Response) {
  sendData(res, await userService.getMyStats(requireAuth(req).userId));
}

export async function me(req: Request, res: Response) {
  sendData(res, await userService.getMyProfile(requireAuth(req).userId));
}

export async function updateProfile(req: Request, res: Response) {
  rejectRoleFields(req.body); // роль меняет только администратор (npm run set-role)
  const input = validate(updateProfileBody, req.body);
  const { userId } = requireAuth(req);
  const profile = await userService.updateMyProfile(userId, input);
  // Новое место — другой набор чатов: подписки WebSocket на ставшие недоступными чаты снимаются
  if (input.location) revalidateAccess(userId);
  sendData(res, profile);
}

export async function getSettings(req: Request, res: Response) {
  sendData(res, await userService.getSettings(requireAuth(req).userId));
}

export async function updateSettings(req: Request, res: Response) {
  const input = validate(updateSettingsBody, req.body);
  sendData(res, await userService.updateSettings(requireAuth(req).userId, input));
}
