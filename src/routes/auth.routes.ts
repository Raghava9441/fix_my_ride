import { Router, Request, Response, NextFunction } from "express";
import { asyncHandler, createSuccessResponse, HttpStatus } from "../utils";

const router = Router();

const authController = {
  register: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "dummy-user-id",
        email: req.body.email || "user@example.com",
      };
      const response = createSuccessResponse(
        result,
        "User registered successfully",
        HttpStatus.CREATED,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  login: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        user: {
          id: "dummy-user-id",
          email: req.body.email || "user@example.com",
        },
        accessToken: "dummy-access-token",
        refreshToken: "dummy-refresh-token",
      };
      const response = createSuccessResponse(
        result,
        "Login successful",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  logout: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        null,
        "Logout successful",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  refreshToken: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        accessToken: "new-dummy-access-token",
        refreshToken: "new-dummy-refresh-token",
      };
      const response = createSuccessResponse(
        result,
        "Token refreshed successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  forgotPassword: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        null,
        "Password reset email sent",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  resetPassword: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        null,
        "Password reset successful",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  changePassword: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        null,
        "Password changed successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  verifyEmail: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { verified: true };
      const response = createSuccessResponse(
        result,
        "Email verified successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  resendVerification: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        null,
        "Verification email sent",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  getMe: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "dummy-user-id",
        email: "user@example.com",
        name: "John Doe",
        role: "owner",
      };
      const response = createSuccessResponse(
        result,
        "User retrieved successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  updateMe: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        id: "dummy-user-id",
        ...req.body,
      };
      const response = createSuccessResponse(
        result,
        "Profile updated successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  googleAuth: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        { url: "/auth/google/callback" },
        "Redirecting to Google",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  googleCallback: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        accessToken: "dummy-google-token",
        refreshToken: "dummy-google-refresh",
      };
      const response = createSuccessResponse(
        result,
        "Google login successful",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  facebookAuth: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        { url: "/auth/facebook/callback" },
        "Redirecting to Facebook",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  facebookCallback: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        accessToken: "dummy-facebook-token",
        refreshToken: "dummy-facebook-refresh",
      };
      const response = createSuccessResponse(
        result,
        "Facebook login successful",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  appleAuth: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        { url: "/auth/apple/callback" },
        "Redirecting to Apple",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  appleCallback: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        accessToken: "dummy-apple-token",
        refreshToken: "dummy-apple-refresh",
      };
      const response = createSuccessResponse(
        result,
        "Apple login successful",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  setupMFA: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        secret: "dummy-mfa-secret",
        qrCode: "data:image/png;base64,dummy",
      };
      const response = createSuccessResponse(
        result,
        "MFA setup initialized",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  verifyMFA: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = { verified: true };
      const response = createSuccessResponse(
        result,
        "MFA code verified",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  enableMFA: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        null,
        "MFA enabled successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  disableMFA: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const response = createSuccessResponse(
        null,
        "MFA disabled successfully",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),

  generateBackupCodes: asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const result = {
        backupCodes: [
          "code1",
          "code2",
          "code3",
          "code4",
          "code5",
          "code6",
          "code7",
          "code8",
        ],
      };
      const response = createSuccessResponse(
        result,
        "Backup codes generated",
        HttpStatus.OK,
      );
      res.status(response.statusCode).json(response.toJSON());
    },
  ),
};

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/change-password", authController.changePassword);
router.get("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);
router.get("/me", authController.getMe);
router.put("/me", authController.updateMe);

router.get("/google", authController.googleAuth);
router.get("/google/callback", authController.googleCallback);
router.get("/facebook", authController.facebookAuth);
router.get("/facebook/callback", authController.facebookCallback);
router.get("/apple", authController.appleAuth);
router.post("/apple/callback", authController.appleCallback);

router.post("/mfa/setup", authController.setupMFA);
router.post("/mfa/verify", authController.verifyMFA);
router.post("/mfa/enable", authController.enableMFA);
router.post("/mfa/disable", authController.disableMFA);
router.post("/mfa/backup-codes", authController.generateBackupCodes);

export default router;
