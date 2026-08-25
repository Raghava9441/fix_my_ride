import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import {
  CreateInvitationSchema,
  UpdateInvitationSchema,
  RevokeInvitationSchema,
} from "../../dto/invitation.dto";

const TAGS = ["Invitations"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/invitations";

registry.registerPath({
  method: "get", path: `${base}/validate`, tags: TAGS, summary: "Validate an invitation token (public — no auth required, used by email links)",
  request: { query: z.object({ token: z.string() }) },
  responses: { 200: { description: "Validity result", content: { "application/json": { schema: successEnvelope("InvitationValidateResponse", z.object({ valid: z.boolean() })) } } } },
});

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List invitations", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ status: z.string().optional(), vehicleId: z.string().optional(), serviceCenterId: z.string().optional() }) },
  responses: { 200: { description: "Invitations", content: { "application/json": { schema: paginatedEnvelope("InvitationListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/me`, tags: TAGS, summary: "List invitations addressed to the current authenticated user's email", security: BEARER_AUTH,
  responses: { 200: { description: "My invitations", content: { "application/json": { schema: successEnvelope("MyInvitationsResponse", z.array(record)) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get an invitation by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Invitation", content: { "application/json": { schema: successEnvelope("InvitationResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create an invitation", security: BEARER_AUTH, request: jsonBody(CreateInvitationSchema),
  responses: { 201: { description: "Invitation created", content: { "application/json": { schema: successEnvelope("InvitationResponse", record) } } }, ...commonErrorResponses({ validate: true }) },
});

registry.registerPath({
  method: "put", path: `${base}/{id}`, tags: TAGS, summary: "Update an invitation (not implemented — the service only exposes accept/revoke/sendReminder transitions, no generic field update)", security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(UpdateInvitationSchema) },
  responses: { 501: { description: "Not implemented" }, ...commonErrorResponses({ validate: true }) },
});

registry.registerPath({
  method: "delete", path: `${base}/{id}`, tags: TAGS, summary: "Delete an invitation", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Invitation deleted", content: { "application/json": { schema: successEnvelope("InvitationDeletedResponse", z.object({ id: z.string(), deleted: z.boolean() })) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/accept`, tags: TAGS, summary: "Accept an invitation as the current authenticated user", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Invitation accepted", content: { "application/json": { schema: successEnvelope("InvitationResponse", record) } } }, 410: { description: "Invitation expired or invalid" }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/decline`, tags: TAGS, summary: "Decline an invitation (implemented as a revoke by the invitee)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Invitation declined", content: { "application/json": { schema: successEnvelope("InvitationResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/resend`, tags: TAGS, summary: "Resend an invitation reminder (max 3 reminders)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Reminder sent", content: { "application/json": { schema: successEnvelope("InvitationResponse", record) } } }, 409: { description: "Max reminders already sent" }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/revoke`, tags: TAGS, summary: "Revoke an invitation", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(RevokeInvitationSchema) },
  responses: { 200: { description: "Invitation revoked", content: { "application/json": { schema: successEnvelope("InvitationResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});
