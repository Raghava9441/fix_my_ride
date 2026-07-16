// src/types/express.d.ts
import { Request } from "express";

/**
 * Represents the authenticated principal attached to a request after the
 * authentication middleware runs.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  roles: string[];
  tenantId?: string;
  permissions?: string[];
  sessionVersion?: number;
  mfaVerified?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      tenantId?: string;
      userId?: string;
      userRole?: string;
      userModel?: string;
      startTime: number;
      context: Map<string, any>;
      user?: AuthUser;
      /** Raw decoded JWT payload (includes jti, exp, etc.) */
      authToken?: Record<string, any>;
    }
  }
}

export type { Request };
