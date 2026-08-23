// src/middleware/tenant/tenantPlugin.ts
import mongoose, { Schema, CallbackError } from "mongoose";
import { getRequestContext } from "../requestContext.middleware";
import { logger } from "../../config/logger";

/**
 * Tenant isolation plugin.
 *
 * Enforces multi-tenant data isolation at the ORM layer so controllers cannot
 * accidentally leak or cross-tenant data. Every query is transparently scoped
 * to the tenant resolved from the request (AsyncLocalStorage), unless:
 *   - the model is registered as "shared" (no tenant scope), or
 *   - the current request belongs to an admin (global scope).
 *
 * Models opt in by calling `schema.plugin(tenantPlugin)` at the bottom of the
 * model file (or by being in DEFAULT_SHARED / the `sharedCollections` option,
 * which both leave the model unscoped instead).
 */

export interface TenantPluginOptions {
  /** Collection names that are shared across tenants (no scoping). */
  sharedCollections?: string[];
}

const TENANT_FIELD = "tenantId";

const DEFAULT_SHARED = ["vehicles", "owners", "ownerprofiles", "tenants"];

function getActiveTenantId(): { tenantId?: string; isAdmin: boolean; hasContext: boolean } {
  const ctx = getRequestContext();
  const tenantId = ctx.get("tenantId") as string | undefined;
  const userRoles = (ctx.get("userRoles") as string[] | undefined) ?? [];
  const isAdmin = userRoles.includes("admin");
  return { tenantId, isAdmin, hasContext: ctx.size > 0 };
}

export const tenantPlugin = (
  schema: Schema<any, any, any, any, any, any>,
  options: TenantPluginOptions = {},
): void => {
  const shared = new Set([...DEFAULT_SHARED, ...(options.sharedCollections ?? [])]);
  const collectionName = (schema as any).options?.collection as string | undefined;
  const isShared = shared.has((collectionName ?? "").toLowerCase());

  if (isShared) return; // Shared collections are never tenant-scoped.

  // Ensure the field exists
  if (!(schema as any).paths[TENANT_FIELD]) {
    schema.add({ [TENANT_FIELD]: { type: Schema.Types.ObjectId, index: true } });
  }

  const applyTenantScope = function (this: any) {
    // Only scope mongoose queries (have a `this.op`)
    if (!this.op) return;

    const { tenantId, isAdmin, hasContext } = getActiveTenantId();

    // Admin sees everything; no context (e.g. background jobs) is unscoped too.
    if (isAdmin || !hasContext) return;

    if (!tenantId) {
      // No tenant resolved for a scoped query -> fail safe (return nothing).
      logger.warn({
        type: "tenant_isolation_blocked",
        collection: collectionName,
        message: "Query attempted without tenant context on a scoped model",
      });
      this.where({ [TENANT_FIELD]: { $eq: null as any } }); // matches nothing
      return;
    }

    const filter = this.getQuery();
    if (filter[TENANT_FIELD] === undefined) {
      this.where({ [TENANT_FIELD]: new mongoose.Types.ObjectId(tenantId) });
    }
  };

  const QUERY_OPS = ["find", "findOne", "findOneAndUpdate", "findOneAndDelete", "countDocuments", "updateMany", "deleteMany", "distinct"];
  QUERY_OPS.forEach((op) => {
    schema.pre(op as any, applyTenantScope);
  });

  // Aggregate: inject a $match at the start of the pipeline.
  schema.pre("aggregate", function (this: any) {
    const { tenantId, isAdmin, hasContext } = getActiveTenantId();
    if (isAdmin || !hasContext || !tenantId) return;
    const pipeline = this.pipeline();
    const alreadyScoped = pipeline.some(
      (stage: any) => stage.$match && stage.$match[TENANT_FIELD],
    );
    if (!alreadyScoped) {
      pipeline.unshift({ $match: { [TENANT_FIELD]: new mongoose.Types.ObjectId(tenantId) } });
    }
  });

  // On save, stamp tenantId from context if missing.
  schema.pre("save", function (this: any, next: (err?: CallbackError) => void) {
    const { tenantId, hasContext } = getActiveTenantId();
    if (hasContext && tenantId && this[TENANT_FIELD] == null) {
      this[TENANT_FIELD] = new mongoose.Types.ObjectId(tenantId);
    }
    next();
  });

  // insertMany: stamp each doc.
  schema.pre("insertMany", function (this: any, next: (err?: CallbackError) => void) {
    const { tenantId, hasContext } = getActiveTenantId();
    if (hasContext && tenantId && Array.isArray((this as any).docs)) {
      (this as any).docs.forEach((doc: any) => {
        if (doc[TENANT_FIELD] == null) doc[TENANT_FIELD] = new mongoose.Types.ObjectId(tenantId);
      });
    }
    next();
  });
};
