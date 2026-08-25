import { z } from "zod";
import { registry } from "../registry";
import {
  successEnvelope,
  paginatedEnvelope,
  commonErrorResponses,
  BEARER_AUTH,
  IdParamSchema,
  PaginationQuerySchema,
} from "../common";
import {
  CreateAccountSchema,
  UpdateAccountSchema,
  AssignRoleSchema,
  SwitchRoleSchema,
  UpdateAccountStatusSchema,
} from "../../dto/account.dto";

const TAGS = ["Accounts"];
const AccountSchema = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/accounts",
  tags: TAGS,
  summary: "List accounts",
  security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ status: z.string().optional(), tenantId: z.string().optional() }) },
  responses: {
    200: { description: "Accounts", content: { "application/json": { schema: paginatedEnvelope("AccountListResponse", AccountSchema) } } },
    ...commonErrorResponses(),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/accounts/{id}",
  tags: TAGS,
  summary: "Get an account by id",
  security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Account", content: { "application/json": { schema: successEnvelope("AccountResponse", AccountSchema) } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/accounts",
  tags: TAGS,
  summary: "Create an account",
  request: jsonBody(CreateAccountSchema),
  responses: {
    201: { description: "Account created", content: { "application/json": { schema: successEnvelope("AccountCreatedResponse", AccountSchema) } } },
    409: { description: "Email already registered" },
    ...commonErrorResponses({ auth: false, validate: true }),
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/accounts/{id}",
  tags: TAGS,
  summary: "Update an account",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(UpdateAccountSchema) },
  responses: {
    200: { description: "Account updated", content: { "application/json": { schema: successEnvelope("AccountResponse", AccountSchema) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/accounts/{id}",
  tags: TAGS,
  summary: "Soft-delete an account",
  security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Account deleted", content: { "application/json": { schema: successEnvelope("AccountDeletedResponse", z.object({ id: z.string(), deleted: z.boolean(), deletedAt: z.string() })) } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/accounts/{id}/status",
  tags: TAGS,
  summary: "Update an account's status (active/suspended/locked/...)",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(UpdateAccountStatusSchema) },
  responses: {
    200: { description: "Status updated", content: { "application/json": { schema: successEnvelope("AccountStatusResponse", z.object({ id: z.string(), status: z.string() })) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/accounts/{id}/roles",
  tags: TAGS,
  summary: "Assign a role to an account",
  security: BEARER_AUTH,
  request: { params: IdParamSchema, ...jsonBody(AssignRoleSchema) },
  responses: {
    201: { description: "Role assigned", content: { "application/json": { schema: successEnvelope("RoleAssignedResponse", z.object({ accountId: z.string(), roleId: z.string() })) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/accounts/{id}/roles/{roleId}",
  tags: TAGS,
  summary: "Remove a role from an account",
  security: BEARER_AUTH,
  request: { params: z.object({ id: z.string(), roleId: z.string() }) },
  responses: {
    200: { description: "Role removed", content: { "application/json": { schema: successEnvelope("RoleRemovedResponse", z.object({ accountId: z.string(), roleId: z.string(), removed: z.boolean() })) } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/accounts/{id}/permissions",
  tags: TAGS,
  summary: "Get an account's effective permissions",
  security: BEARER_AUTH,
  request: { params: IdParamSchema },
  responses: {
    200: { description: "Permissions", content: { "application/json": { schema: successEnvelope("AccountPermissionsResponse", z.array(z.any())) } } },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/accounts/switch-role",
  tags: TAGS,
  summary: "Switch the active role for an account",
  security: BEARER_AUTH,
  request: jsonBody(SwitchRoleSchema),
  responses: {
    200: { description: "Role switched", content: { "application/json": { schema: successEnvelope("RoleSwitchedResponse", z.object({ accountId: z.string(), newRoleId: z.string() })) } } },
    ...commonErrorResponses({ notFound: true, validate: true }),
  },
});
