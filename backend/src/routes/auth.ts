import { Router } from "express";
import {
  loginHandler,
  loginSchema,
  logoutHandler,
  meHandler,
  passwordResetConfirmHandler,
  passwordResetConfirmSchema,
  passwordResetRequestHandler,
  passwordResetRequestSchema,
  refreshHandler,
} from "../controllers/authController.js";
import { loginLimiter, passwordResetLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";

export const authRouter = Router();

authRouter.post("/login", loginLimiter, validate(loginSchema), loginHandler);
authRouter.post("/refresh", refreshHandler);
authRouter.post("/logout", logoutHandler);
authRouter.post(
  "/password-reset/request",
  passwordResetLimiter,
  validate(passwordResetRequestSchema),
  passwordResetRequestHandler
);
authRouter.post(
  "/password-reset/confirm",
  validate(passwordResetConfirmSchema),
  passwordResetConfirmHandler
);
authRouter.get("/me", requireAuth, meHandler);
