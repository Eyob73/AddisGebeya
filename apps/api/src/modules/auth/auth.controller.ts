import crypto from "node:crypto";
import type { CookieOptions, NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "@addisgebeya/shared";
import type { GoogleOAuthIntent } from "@addisgebeya/types";
import {
  googleOAuthStartQuerySchema,
  googleOneTapCredentialSchema,
  isSafeRedirectPath,
} from "@addisgebeya/validation";
import passport from "passport";
import { getAllowedOrigins } from "../../config/cors.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { logger } from "../../utils/logger.js";
import { authService } from "./auth.service.js";
import {
  configureGoogleOAuthStrategy,
  createOAuthStateToken,
  getGoogleOAuthConfig,
  isGoogleOAuthConfigured,
  resolveFrontendOAuthRedirectUrl,
  verifyGoogleIdToken,
  verifyOAuthStateToken,
  type VerifiedGoogleIdentity,
} from "./google-oauth.strategy.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const OAUTH_STATE_COOKIE_NAME = "ag_oauth_state";

function isCrossSiteCookieEnvironment(): boolean {
  if (!env.isProduction) return false;
  try {
    const backendHost = new URL(env.backendUrl).hostname.toLowerCase();
    const origins = getAllowedOrigins();
    return origins.some((origin) => {
      try {
        const parsed = new URL(origin);
        return parsed.protocol === "https:" && parsed.hostname.toLowerCase() !== backendHost;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function getRefreshCookieOptions(): CookieOptions {
  const crossSite = isCrossSiteCookieEnvironment();
  return {
    httpOnly: true,
    secure: env.isProduction || crossSite,
    sameSite: crossSite ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api",
  };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
}

function clearRefreshCookie(res: Response): void {
  const options = getRefreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
  res.clearCookie(REFRESH_COOKIE_NAME, { ...options, path: "/api/v1/auth" });
}

function getOAuthStateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: "/api",
  };
}

function assertOneTapOriginAndCsrf(req: Request, bodyCsrfToken?: string): void {
  const allowedOrigins = new Set(
    [...getAllowedOrigins(), env.backendUrl]
      .filter(Boolean)
      .map((origin) => origin.replace(/\/+$/, "")),
  );

  const originHeader =
    typeof req.headers.origin === "string"
      ? req.headers.origin.trim().replace(/\/+$/, "")
      : undefined;

  if (originHeader) {
    if (!allowedOrigins.has(originHeader)) {
      throw new AppError({
        message: "Request origin is not authorized for Google Sign-In.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "CSRF_ORIGIN_MISMATCH",
      });
    }
  } else if (typeof req.headers.referer === "string" && req.headers.referer.trim()) {
    try {
      const refererOrigin = new URL(req.headers.referer).origin.replace(/\/+$/, "");
      if (!allowedOrigins.has(refererOrigin)) {
        throw new AppError({
          message: "Request referer origin is not authorized for Google Sign-In.",
          statusCode: HTTP_STATUS.FORBIDDEN,
          code: "CSRF_ORIGIN_MISMATCH",
        });
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError({
        message: "Malformed Referer header on Google Sign-In request.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "CSRF_ORIGIN_MISMATCH",
      });
    }
  }

  const cookieCsrfToken =
    typeof req.cookies?.g_csrf_token === "string"
      ? req.cookies.g_csrf_token.trim()
      : undefined;
  const trimmedBodyCsrf = bodyCsrfToken?.trim();

  if (cookieCsrfToken || trimmedBodyCsrf) {
    if (!cookieCsrfToken || !trimmedBodyCsrf) {
      throw new AppError({
        message: "Google CSRF verification token mismatch.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "INVALID_CSRF_TOKEN",
      });
    }

    const cookieBuf = Buffer.from(cookieCsrfToken, "utf8");
    const bodyBuf = Buffer.from(trimmedBodyCsrf, "utf8");
    if (cookieBuf.length !== bodyBuf.length || !crypto.timingSafeEqual(cookieBuf, bodyBuf)) {
      throw new AppError({
        message: "Google CSRF verification token mismatch.",
        statusCode: HTTP_STATUS.FORBIDDEN,
        code: "INVALID_CSRF_TOKEN",
      });
    }
  }
}

function redirectToFrontendWithOAuthError(
  res: Response,
  options: {
    code: string;
    message: string;
    intent?: GoogleOAuthIntent;
    from?: string;
    preferredOrigin?: string;
  },
): void {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, getOAuthStateCookieOptions());

  const target = new URL(resolveFrontendOAuthRedirectUrl(options.preferredOrigin));
  target.searchParams.set("status", "error");
  target.searchParams.set("provider", "google");
  target.searchParams.set("error", options.code);
  target.searchParams.set("message", options.message);
  if (options.intent) {
    target.searchParams.set("intent", options.intent);
  }
  if (options.from && isSafeRedirectPath(options.from)) {
    target.searchParams.set("from", options.from);
  }

  res.redirect(302, target.toString());
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);
    sendSuccess(res, result, "Account registered successfully", HTTP_STATUS.CREATED);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken);
    sendSuccess(res, result, "Logged in successfully", HTTP_STATUS.OK);
  }),

  getGooglePublicConfig: asyncHandler(async (_req: Request, res: Response) => {
    const cfg = getGoogleOAuthConfig();
    const enabled = isGoogleOAuthConfigured() && Boolean(cfg.clientId);
    sendSuccess(
      res,
      {
        enabled,
        clientId: enabled ? cfg.clientId : null,
      },
      "Google OAuth configuration retrieved successfully",
      HTTP_STATUS.OK,
    );
  }),

  googleOneTapAuth: asyncHandler(async (req: Request, res: Response) => {
    if (!isGoogleOAuthConfigured()) {
      throw new AppError({
        message: "Google Sign-In is not configured on the server yet.",
        statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
        code: "GOOGLE_OAUTH_NOT_CONFIGURED",
      });
    }

    const parsed = googleOneTapCredentialSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError({
        message: parsed.error.issues[0]?.message || "Invalid Google credential payload.",
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: "INVALID_GOOGLE_CREDENTIAL",
      });
    }

    assertOneTapOriginAndCsrf(req, parsed.data.g_csrf_token);

    const verifiedIdentity = await verifyGoogleIdToken(parsed.data.credential);
    const result = await authService.authenticateWithGoogle(
      verifiedIdentity,
      parsed.data.intent ?? "login",
    );

    setRefreshCookie(res, result.refreshToken);
    sendSuccess(res, result, "Signed in with Google successfully", HTTP_STATUS.OK);
  }),

  googleAuthStart: (req: Request, res: Response, next: NextFunction): void => {
    const parsed = googleOAuthStartQuerySchema.safeParse(req.query);
    const intent: GoogleOAuthIntent = parsed.success && parsed.data.intent ? parsed.data.intent : "login";
    const candidateFrom = parsed.success ? parsed.data.from ?? parsed.data.redirectTo : undefined;
    const safeFrom = candidateFrom && isSafeRedirectPath(candidateFrom) ? candidateFrom : undefined;
    const requestedOrigin = parsed.success ? parsed.data.origin : undefined;

    if (!isGoogleOAuthConfigured() || !configureGoogleOAuthStrategy()) {
      logger.warn("Google OAuth start attempted without configured credentials");
      if (req.accepts("html")) {
        redirectToFrontendWithOAuthError(res, {
          code: "GOOGLE_OAUTH_NOT_CONFIGURED",
          message: "Google Sign-In is not configured on the server yet.",
          intent,
          from: safeFrom,
          preferredOrigin: requestedOrigin,
        });
        return;
      }

      next(
        new AppError({
          message: "Google Sign-In is not configured on the server yet.",
          statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
          code: "GOOGLE_OAUTH_NOT_CONFIGURED",
        }),
      );
      return;
    }

    const frontendRedirectUrl = resolveFrontendOAuthRedirectUrl(requestedOrigin);
    const frontendOrigin = new URL(frontendRedirectUrl).origin;
    const { stateToken, nonce } = createOAuthStateToken({
      intent,
      from: safeFrom,
      frontendOrigin,
    });

    res.cookie(OAUTH_STATE_COOKIE_NAME, nonce, getOAuthStateCookieOptions());

    passport.authenticate("google", {
      session: false,
      scope: ["openid", "profile", "email"],
      state: stateToken,
      accessType: "offline",
      prompt: "select_account",
    })(req, res, next);
  },

  googleAuthCallback: (req: Request, res: Response, next: NextFunction): void => {
    const rawState = typeof req.query.state === "string" ? req.query.state : undefined;
    const cookieNonce =
      typeof req.cookies?.[OAUTH_STATE_COOKIE_NAME] === "string"
        ? req.cookies[OAUTH_STATE_COOKIE_NAME]
        : undefined;

    let validatedState: ReturnType<typeof verifyOAuthStateToken> | null = null;
    try {
      validatedState = verifyOAuthStateToken(rawState, cookieNonce);
    } catch (stateErr) {
      if (typeof req.query.error === "string" && req.query.error) {
        logger.warn("Google OAuth returned error from consent screen", {
          oauthError: req.query.error,
        });
        redirectToFrontendWithOAuthError(res, {
          code: req.query.error === "access_denied" ? "OAUTH_CANCELLED" : "GOOGLE_OAUTH_FAILED",
          message:
            req.query.error === "access_denied"
              ? "Google sign-in was cancelled."
              : "Google sign-in could not be completed.",
        });
        return;
      }

      const appErr =
        stateErr instanceof AppError
          ? stateErr
          : new AppError({
              message: "Invalid OAuth state parameter.",
              statusCode: HTTP_STATUS.UNAUTHORIZED,
              code: "INVALID_OAUTH_STATE",
            });
      logger.warn("Google OAuth state verification failed", { code: appErr.code });
      redirectToFrontendWithOAuthError(res, {
        code: appErr.code,
        message: appErr.message,
      });
      return;
    }

    res.clearCookie(OAUTH_STATE_COOKIE_NAME, getOAuthStateCookieOptions());

    if (typeof req.query.error === "string" && req.query.error) {
      const cancelled = req.query.error === "access_denied";
      logger.warn("Google OAuth provider returned error", { oauthError: req.query.error });
      redirectToFrontendWithOAuthError(res, {
        code: cancelled ? "OAUTH_CANCELLED" : "GOOGLE_OAUTH_FAILED",
        message: cancelled
          ? "Google sign-in was cancelled before completion."
          : "Google authentication failed. Please try again.",
        intent: validatedState.intent,
        from: validatedState.from,
        preferredOrigin: validatedState.frontendOrigin,
      });
      return;
    }

    if (!isGoogleOAuthConfigured() || !configureGoogleOAuthStrategy()) {
      redirectToFrontendWithOAuthError(res, {
        code: "GOOGLE_OAUTH_NOT_CONFIGURED",
        message: "Google Sign-In is not configured on the server yet.",
        intent: validatedState.intent,
        from: validatedState.from,
        preferredOrigin: validatedState.frontendOrigin,
      });
      return;
    }

    passport.authenticate(
      "google",
      { session: false },
      async (err: unknown, verifiedIdentity: VerifiedGoogleIdentity | false | undefined) => {
        if (err || !verifiedIdentity) {
          const code = err instanceof AppError ? err.code : "GOOGLE_OAUTH_FAILED";
          const message =
            err instanceof AppError
              ? err.message
              : "Could not verify your Google account. Please try again.";

          logger.warn("Passport Google OAuth verification error", {
            code,
            error: err instanceof Error ? err.message : String(err ?? "no_identity"),
          });

          redirectToFrontendWithOAuthError(res, {
            code,
            message,
            intent: validatedState.intent,
            from: validatedState.from,
            preferredOrigin: validatedState.frontendOrigin,
          });
          return;
        }

        try {
          const authResult = await authService.authenticateWithGoogle(
            verifiedIdentity,
            validatedState.intent,
          );

          setRefreshCookie(res, authResult.refreshToken);

          const redirectTarget = new URL(
            resolveFrontendOAuthRedirectUrl(validatedState.frontendOrigin),
          );
          redirectTarget.searchParams.set("status", "success");
          redirectTarget.searchParams.set("provider", "google");
          redirectTarget.searchParams.set("intent", validatedState.intent);
          redirectTarget.searchParams.set("isNewUser", String(authResult.isNewUser));
          redirectTarget.searchParams.set("linked", String(authResult.linkedExistingAccount));
          if (validatedState.from && isSafeRedirectPath(validatedState.from)) {
            redirectTarget.searchParams.set("from", validatedState.from);
          }

          res.redirect(302, redirectTarget.toString());
        } catch (authErr) {
          const code = authErr instanceof AppError ? authErr.code : "GOOGLE_AUTH_FAILED";
          const message =
            authErr instanceof AppError
              ? authErr.message
              : "Failed to complete Google sign-in.";

          logger.warn("Google OAuth user resolution failed", {
            code,
            error: authErr instanceof Error ? authErr.message : String(authErr),
          });

          redirectToFrontendWithOAuthError(res, {
            code,
            message,
            intent: validatedState.intent,
            from: validatedState.from,
            preferredOrigin: validatedState.frontendOrigin,
          });
        }
      },
    )(req, res, next);
  },

  refreshToken: asyncHandler(async (req: Request, res: Response) => {
    const token = (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) || req.body?.refreshToken;
    const result = await authService.refreshToken(token);
    setRefreshCookie(res, result.refreshToken);
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
    const { currentPassword = "", newPassword } = req.body;
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    if (result.refreshToken) {
      setRefreshCookie(res, result.refreshToken);
    } else {
      clearRefreshCookie(res);
    }
    sendSuccess(res, result, result.message, HTTP_STATUS.OK);
  }),

  logoutAll: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const result = await authService.logoutAll(userId);
    clearRefreshCookie(res);
    sendSuccess(res, result, "Logged out from all devices successfully", HTTP_STATUS.OK);
  }),

  deactivateAccount: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { passwordConfirm } = req.body;
    const result = await authService.deactivateAccount(userId, passwordConfirm);
    clearRefreshCookie(res);
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
    clearRefreshCookie(res);
    sendSuccess(res, { loggedOut: true }, "Logged out successfully", HTTP_STATUS.OK);
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    sendSuccess(res, result, result.message, HTTP_STATUS.OK);
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email, newPassword } = req.body;
    const result = await authService.resetPassword(email, newPassword);
    clearRefreshCookie(res);
    sendSuccess(res, result, "Password has been reset successfully", HTTP_STATUS.OK);
  }),
};
