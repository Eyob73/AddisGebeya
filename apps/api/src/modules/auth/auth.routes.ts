import { Router, type RequestHandler } from "express";
import { optionalAuth, requireAuth } from "../../middlewares/auth.middleware.js";
import { uploadMedia } from "../media/media.middleware.js";
import { authController } from "./auth.controller.js";

const optionalAvatarUpload: RequestHandler = (req, res, next) => {
  if (req.is("multipart/form-data")) {
    uploadMedia.single("avatar")(req, res, next);
    return;
  }
  next();
};

const authRouter: Router = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.get("/google/config", authController.getGooglePublicConfig);
authRouter.post("/google/one-tap", authController.googleOneTapAuth);
authRouter.post("/google", authController.googleOneTapAuth);
authRouter.get("/google", authController.googleAuthStart);
authRouter.get("/google/callback", authController.googleAuthCallback);
authRouter.post("/refresh-token", authController.refreshToken);
authRouter.post("/logout", optionalAuth, authController.logout);
authRouter.post("/forgot-password", authController.forgotPassword);
authRouter.post("/reset-password", authController.resetPassword);

// Protected routes
authRouter.get("/me", requireAuth, authController.getMe);
authRouter.patch("/profile", requireAuth, authController.updateProfile);
authRouter.post("/change-password", requireAuth, authController.changePassword);
authRouter.post("/logout-all", requireAuth, authController.logoutAll);
authRouter.post("/deactivate", requireAuth, authController.deactivateAccount);
authRouter.post("/avatar", requireAuth, optionalAvatarUpload, authController.uploadAvatar);

export { authRouter };
