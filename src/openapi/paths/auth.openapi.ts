import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, commonErrorResponses, BEARER_AUTH } from "../common";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  VerifyMFASchema,
} from "../../dto/auth.dto";

const TAGS = ["Auth"];
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});

const TokenPairSchema = successEnvelope(
  "TokenPairResponse",
  z.object({
    id: z.string(),
    email: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
  }),
);

const AccountSchema = successEnvelope("AccountResponse", z.record(z.any()));
const OkSchema = successEnvelope("OkResponse", z.any().nullable());

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/register",
  tags: TAGS,
  summary: "Register a new account",
  request: jsonBody(RegisterSchema),
  responses: {
    201: { description: "Account created", content: { "application/json": { schema: TokenPairSchema } } },
    ...commonErrorResponses({ auth: false, validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/login",
  tags: TAGS,
  summary: "Log in with email and password",
  description: "Returns tokens directly, or an MFA_REQUIRED error with an mfaToken if the account has MFA enabled.",
  request: jsonBody(LoginSchema),
  responses: {
    200: { description: "Login successful", content: { "application/json": { schema: TokenPairSchema } } },
    ...commonErrorResponses({ auth: false, validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/mfa/verify",
  tags: TAGS,
  summary: "Complete login by verifying an MFA code",
  request: jsonBody(z.object({ mfaToken: z.string(), code: z.string().length(6) })),
  responses: {
    200: { description: "MFA verified, login successful", content: { "application/json": { schema: TokenPairSchema } } },
    ...commonErrorResponses({ auth: false, validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/refresh-token",
  tags: TAGS,
  summary: "Exchange a refresh token for a new access token",
  request: jsonBody(z.object({ refreshToken: z.string() })),
  responses: {
    200: { description: "Token refreshed", content: { "application/json": { schema: TokenPairSchema } } },
    ...commonErrorResponses({ auth: false }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/logout",
  tags: TAGS,
  summary: "Revoke the current access + refresh tokens",
  request: jsonBody(z.object({ refreshToken: z.string().optional() })),
  responses: { 200: { description: "Logged out", content: { "application/json": { schema: OkSchema } } } },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/forgot-password",
  tags: TAGS,
  summary: "Request a password reset email",
  description: "Always returns success to avoid account enumeration.",
  request: jsonBody(ForgotPasswordSchema),
  responses: {
    200: { description: "Reset email sent (if the account exists)", content: { "application/json": { schema: OkSchema } } },
    ...commonErrorResponses({ auth: false, validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/reset-password",
  tags: TAGS,
  summary: "Reset a password using a reset token",
  request: jsonBody(ResetPasswordSchema),
  responses: {
    200: { description: "Password reset", content: { "application/json": { schema: OkSchema } } },
    ...commonErrorResponses({ auth: false, validate: true }),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/verify-email",
  tags: TAGS,
  summary: "Verify an email address via token",
  request: { query: z.object({ token: z.string() }) },
  responses: {
    200: { description: "Email verified", content: { "application/json": { schema: OkSchema } } },
    ...commonErrorResponses({ auth: false }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/resend-verification",
  tags: TAGS,
  summary: "Resend the email verification link",
  request: jsonBody(z.object({ email: z.string().email() })),
  responses: { 200: { description: "Verification email sent", content: { "application/json": { schema: OkSchema } } } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/auth/me",
  tags: TAGS,
  summary: "Get the current authenticated account",
  security: BEARER_AUTH,
  responses: {
    200: { description: "Current account", content: { "application/json": { schema: AccountSchema } } },
    ...commonErrorResponses(),
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/auth/me",
  tags: TAGS,
  summary: "Update the current account's own profile",
  security: BEARER_AUTH,
  request: jsonBody(z.record(z.any())),
  responses: {
    200: { description: "Profile updated", content: { "application/json": { schema: AccountSchema } } },
    ...commonErrorResponses({ validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/change-password",
  tags: TAGS,
  summary: "Change the current account's password",
  security: BEARER_AUTH,
  request: jsonBody(ChangePasswordSchema),
  responses: {
    200: { description: "Password changed", content: { "application/json": { schema: OkSchema } } },
    ...commonErrorResponses({ validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/mfa/setup",
  tags: TAGS,
  summary: "Initialize MFA setup (returns a secret + QR data)",
  security: BEARER_AUTH,
  responses: {
    200: { description: "MFA setup initialized", content: { "application/json": { schema: successEnvelope("MfaSetupResponse", z.record(z.any())) } } },
    ...commonErrorResponses(),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/mfa/enable",
  tags: TAGS,
  summary: "Enable MFA after verifying a setup code",
  security: BEARER_AUTH,
  request: jsonBody(VerifyMFASchema),
  responses: {
    200: { description: "MFA enabled", content: { "application/json": { schema: OkSchema } } },
    ...commonErrorResponses({ validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/mfa/disable",
  tags: TAGS,
  summary: "Disable MFA",
  security: BEARER_AUTH,
  request: jsonBody(VerifyMFASchema),
  responses: {
    200: { description: "MFA disabled", content: { "application/json": { schema: OkSchema } } },
    ...commonErrorResponses({ validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/mfa/backup-codes",
  tags: TAGS,
  summary: "Generate new MFA backup codes",
  security: BEARER_AUTH,
  responses: {
    200: {
      description: "Backup codes generated",
      content: { "application/json": { schema: successEnvelope("BackupCodesResponse", z.object({ backupCodes: z.array(z.string()) })) } },
    },
    ...commonErrorResponses(),
  },
});
