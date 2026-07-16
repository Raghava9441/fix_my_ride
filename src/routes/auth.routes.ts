import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";
import { authenticate } from "../middleware/auth.middleware";
import authService, { NotifyFn } from "../services/auth.service";
import { AppError } from "../utils/appError";
import { ERROR_CODES } from "../constants/errors";
import { enqueue } from "../services/queue.service";
import { EMAIL_QUEUE } from "../workers";

const router = Router();

// Enqueue email notifications to the background worker queue.
const notify: NotifyFn = (type, payload) => {
  void enqueue(EMAIL_QUEUE, { type, data: payload }).catch((err) => {
    // Logged; the request itself should not fail because of a notification.
    console.error("Failed to enqueue notification:", err);
  });
};

const getBearer = (req: Request): string | undefined =>
  req.headers.authorization?.split(" ")[1];

// ─── Public routes ──────────────────────────────────────────────────────────

router.post(
  "/register",
  asyncHandler(async (req: Request, res: Response) => {
    const { account, tokens } = await authService.register({
      email: req.body.email,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      tenantId: req.body.tenantId,
      tenantSlug: req.body.tenantSlug,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      notify,
    });
    res
      .status(HttpStatus.CREATED)
      .json(
        createSuccessResponse(
          { id: account._id, email: account.email, ...tokens },
          "User registered successfully",
          HttpStatus.CREATED,
        ),
      );
  }),
);

router.post(
  "/login",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { account, tokens } = await authService.login({
        email: req.body.email,
        password: req.body.password,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        notify,
      });
      res
        .status(HttpStatus.OK)
        .json(
          createSuccessResponse(
            { user: { id: account._id, email: account.email, role: account.primaryRole }, ...tokens },
            "Login successful",
            HttpStatus.OK,
          ),
        );
    } catch (err) {
      // MFA_REQUIRED carries an mfaToken in details -> surface it
      if (err instanceof AppError && err.code === ERROR_CODES.MFA_REQUIRED.code) {
        return res.status(err.httpStatus).json({
          success: false,
          code: err.code,
          key: err.key,
          correlationId: err.correlationId,
          message: err.message,
          details: err.details,
          timestamp: new Date().toISOString(),
        });
      }
      throw err;
    }
  }),
);

router.post(
  "/mfa/verify",
  asyncHandler(async (req: Request, res: Response) => {
    const { account, tokens } = await authService.verifyMfa({
      mfaToken: req.body.mfaToken,
      code: req.body.code,
      notify,
    });
    res
      .status(HttpStatus.OK)
      .json(
        createSuccessResponse(
          { user: { id: account._id, email: account.email }, ...tokens },
          "MFA verified, login successful",
          HttpStatus.OK,
        ),
      );
  }),
);

router.post(
  "/refresh-token",
  asyncHandler(async (req: Request, res: Response) => {
    const tokens = await authService.refresh({ refreshToken: req.body.refreshToken });
    res
      .status(HttpStatus.OK)
      .json(createSuccessResponse(tokens, "Token refreshed successfully", HttpStatus.OK));
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req: Request, res: Response) => {
    await authService.logout({
      accessToken: getBearer(req) ?? "",
      refreshToken: req.body.refreshToken,
    });
    res.status(HttpStatus.OK).json(createSuccessResponse(null, "Logout successful", HttpStatus.OK));
  }),
);

router.post(
  "/forgot-password",
  asyncHandler(async (req: Request, res: Response) => {
    await authService.forgotPassword({ email: req.body.email, notify });
    // Always success to avoid enumeration
    res
      .status(HttpStatus.OK)
      .json(createSuccessResponse(null, "Password reset email sent", HttpStatus.OK));
  }),
);

router.post(
  "/reset-password",
  asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword({ token: req.body.token, password: req.body.password });
    res
      .status(HttpStatus.OK)
      .json(createSuccessResponse(null, "Password reset successful", HttpStatus.OK));
  }),
);

router.get(
  "/verify-email",
  asyncHandler(async (req: Request, res: Response) => {
    await authService.verifyEmail({ token: req.query.token as string });
    res
      .status(HttpStatus.OK)
      .json(createSuccessResponse({ verified: true }, "Email verified successfully", HttpStatus.OK));
  }),
);

router.post(
  "/resend-verification",
  asyncHandler(async (req: Request, res: Response) => {
    await authService.resendVerification({ email: req.body.email, notify });
    res
      .status(HttpStatus.OK)
      .json(createSuccessResponse(null, "Verification email sent", HttpStatus.OK));
  }),
);

// ─── Protected routes ────────────────────────────────────────────────────────

router.get("/me", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const account = await authService.getMe(req.user!.id);
  res.status(HttpStatus.OK).json(createSuccessResponse(account, "User retrieved successfully", HttpStatus.OK));
}));

router.put("/me", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const account = await authService.updateMe(req.user!.id, req.body);
  res.status(HttpStatus.OK).json(createSuccessResponse(account, "Profile updated successfully", HttpStatus.OK));
}));

router.post("/change-password", authenticate, asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword({
    userId: req.user!.id,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  res.status(HttpStatus.OK).json(createSuccessResponse(null, "Password changed successfully", HttpStatus.OK));
}));

router.post("/mfa/setup", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.setupMfa(req.user!.id);
  res.status(HttpStatus.OK).json(createSuccessResponse(result, "MFA setup initialized", HttpStatus.OK));
}));

router.post("/mfa/enable", authenticate, asyncHandler(async (req: Request, res: Response) => {
  await authService.enableMfa({ userId: req.user!.id, code: req.body.code });
  res.status(HttpStatus.OK).json(createSuccessResponse(null, "MFA enabled successfully", HttpStatus.OK));
}));

router.post("/mfa/disable", authenticate, asyncHandler(async (req: Request, res: Response) => {
  await authService.disableMfa({ userId: req.user!.id, code: req.body.code });
  res.status(HttpStatus.OK).json(createSuccessResponse(null, "MFA disabled successfully", HttpStatus.OK));
}));

router.post("/mfa/backup-codes", authenticate, asyncHandler(async (req: Request, res: Response) => {
  const codes = await authService.generateBackupCodes(req.user!.id);
  res.status(HttpStatus.OK).json(createSuccessResponse({ backupCodes: codes }, "Backup codes generated", HttpStatus.OK));
}));

// ─── OAuth (placeholder - requires provider config) ──────────────────────────

const oauthNotImplemented = (_req: Request, res: Response) => {
  res
    .status(HttpStatus.NOT_IMPLEMENTED)
    .json(createSuccessResponse(null, "OAuth provider not configured", HttpStatus.NOT_IMPLEMENTED));
};

router.get("/google", oauthNotImplemented);
router.get("/google/callback", oauthNotImplemented);
router.get("/facebook", oauthNotImplemented);
router.get("/facebook/callback", oauthNotImplemented);
router.get("/apple", oauthNotImplemented);
router.post("/apple/callback", oauthNotImplemented);

export default router;
