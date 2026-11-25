import type { CookieOptions, Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { authService } from "./auth.service.js";

const REFRESH_COOKIE_NAME = "refreshToken";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/api/v1/auth",
};

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);
    sendSuccess(res, result, "Account registered successfully", HTTP_STATUS.CREATED);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);
    sendSuccess(res, result, "Logged in successfully", HTTP_STATUS.OK);
  }),

  refreshToken: asyncHandler(async (req: Request, res: Response) => {
    const token = (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) || req.body?.refreshToken;
    const result = await authService.refreshToken(token);
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);
    sendSuccess(res, result, "Tokens refreshed successfully", HTTP_STATUS.OK);
  }),

  getMe: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const user = await authService.getMe(userId);
    sendSuccess(res, user, "User profile retrieved successfully", HTTP_STATUS.OK);
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const updated = await authService.updateProfile(userId, req.body);
    sendSuccess(res, updated, "Profile updated successfully", HTTP_STATUS.OK);
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    if (result.refreshToken) {
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, cookieOptions);
    } else {
      res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    }
    sendSuccess(res, result, result.message, HTTP_STATUS.OK);
  }),

  logoutAll: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await authService.logoutAll(userId);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    sendSuccess(res, result, "Logged out from all devices successfully", HTTP_STATUS.OK);
  }),

  deactivateAccount: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { passwordConfirm } = req.body;
    const result = await authService.deactivateAccount(userId, passwordConfirm);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    sendSuccess(res, result, "Account deactivated successfully", HTTP_STATUS.OK);
  }),

  uploadAvatar: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const file = req.file
      ? { buffer: req.file.buffer, originalname: req.file.originalname }
      : undefined;
    const avatarUrl = typeof req.body?.avatarUrl === "string" ? req.body.avatarUrl : undefined;
    const result = await authService.uploadAvatar(userId, { avatarUrl, file });
    sendSuccess(res, result, "Avatar updated successfully", HTTP_STATUS.OK);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const token = (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) || req.body?.refreshToken;
    const userId = req.user?.id;
    await authService.logout(token, userId);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    sendSuccess(res, { loggedOut: true }, "Logged out successfully", HTTP_STATUS.OK);
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    sendSuccess(res, result, result.message, HTTP_STATUS.OK);
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email, newPassword } = req.body;
    const result = await authService.resetPassword(email, newPassword);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    sendSuccess(res, result, "Password has been reset successfully", HTTP_STATUS.OK);
  }),
};
