import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, commonErrorResponses, BEARER_AUTH } from "../common";
import { SignupOrganizationSchema } from "../../dto/onboarding.dto";

const TAGS = ["Onboarding"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/onboarding";

registry.registerPath({
  method: "post", path: `${base}/signup`, tags: TAGS, summary: "Sign up a new organization (creates Tenant + Account + first ServiceCenter)",
  request: jsonBody(SignupOrganizationSchema),
  responses: {
    201: {
      description:
        "Application submitted — tokens are issued immediately (matching /auth/register's existing behavior) but full login is gated on BOTH email verification and platform-admin approval (Tenant.onboarding.status).",
      content: { "application/json": { schema: successEnvelope("OnboardingSignupResponse", record) } },
    },
    409: { description: "Email already registered, or business registration number already in use" },
    ...commonErrorResponses({ validate: true }),
  },
});

registry.registerPath({
  method: "get", path: `${base}/status`, tags: TAGS, summary: "Get the caller's own organization's onboarding status", security: BEARER_AUTH,
  responses: {
    200: {
      description: "Real onboarding status — replaces the old GET /api/v1/public/onboarding/status stub, which always returned a hardcoded fake response.",
      content: { "application/json": { schema: successEnvelope("OnboardingStatusResponse", z.object({
        organizationName: z.string(),
        emailVerified: z.boolean(),
        onboardingStatus: z.enum(["pending_review", "approved", "rejected"]),
        rejectionReason: z.string().optional(),
        ready: z.boolean(),
      })) } },
    },
    ...commonErrorResponses({ notFound: true }),
  },
});
