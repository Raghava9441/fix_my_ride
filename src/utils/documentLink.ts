import { generateToken, verifyToken } from "./token";
import { config } from "../config/environment";

/**
 * Short-lived, single-purpose download links for documents.
 *
 * A browser can't attach an `Authorization` header to an `<a href>` or
 * `window.open`, so an authenticated download endpoint can't be linked to
 * directly. Instead the client asks `GET /documents/:id/link` (authenticated,
 * access-checked) and gets back a URL carrying one of these tokens, which
 * `GET /documents/download/:token` accepts without a session.
 *
 * The token uses its own audience so it can never be replayed as an access
 * token (`authenticate` requires `fix-my-ride-clients`), and an access token
 * can never be replayed here. It carries the document id and tenant, nothing
 * about the user, and expires in minutes.
 */
export const DOCUMENT_LINK_AUDIENCE = "fix-my-ride-document-download";
export const DOCUMENT_LINK_TTL_SECONDS = 5 * 60;

export interface DocumentLinkPayload {
  documentId: string;
  tenantId?: string;
}

export function signDocumentLink(
  payload: DocumentLinkPayload,
  secret: string = config.jwt.secret,
): { token: string; expiresAt: Date } {
  const token = generateToken({ ...payload }, secret, {
    expiresIn: DOCUMENT_LINK_TTL_SECONDS,
    audience: DOCUMENT_LINK_AUDIENCE,
  });
  return { token, expiresAt: new Date(Date.now() + DOCUMENT_LINK_TTL_SECONDS * 1000) };
}

export function verifyDocumentLink(
  token: string,
  secret: string = config.jwt.secret,
): DocumentLinkPayload | null {
  const decoded = verifyToken<DocumentLinkPayload & Record<string, unknown>>(token, secret, {
    audience: DOCUMENT_LINK_AUDIENCE,
  });
  if (!decoded || typeof decoded.documentId !== "string") return null;
  return { documentId: decoded.documentId, tenantId: decoded.tenantId };
}
