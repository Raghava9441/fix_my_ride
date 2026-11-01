import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { DocumentService } from "../services/document.service";
import { StorageService } from "../services/storage.service";
import { Document } from "../models/Document";
import { staffProfileService } from "../services/staff.service";
import { signDocumentLink, verifyDocumentLink } from "../utils/documentLink";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

/** Roles that may manage any document in the tenant, not just their own uploads. */
const MANAGER_ROLES = ["admin", "staff"];

export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Whether the caller may change or remove this document: its uploader, or
   * someone on the staff side. Reading is governed separately by
   * `isAccessibleBy`; these routes previously checked nothing, so any
   * signed-in user could archive or delete any document in the tenant.
   *
   * Staff-side is a role *or* a staff profile. A workspace owner carries the
   * account role `owner` - the same as a customer - and is only recognisable
   * as staff by their profile, so checking roles alone would stop them
   * managing their own workspace's documents.
   */
  private async canManage(req: Request, document: any): Promise<boolean> {
    const user = req.user;
    if (!user) return false;
    const roles = user.roles ?? [user.role];
    if (roles.some((role) => MANAGER_ROLES.includes(role))) return true;
    if (document.accountId && String(document.accountId) === user.id) return true;
    return Boolean(await staffProfileService.findByAccountId(user.id));
  }

  private forbidden(res: Response, message = "You don't have permission to change this document") {
    const error = createErrorResponse(message, HttpStatus.FORBIDDEN);
    return res.status(error.statusCode).json(error.toJSON());
  }

  private canRead(req: Request, document: any): boolean {
    const user = req.user;
    if (!user) return false;
    return document.isAccessibleBy(user.id, user.role) || Boolean(user.roles?.includes("admin"));
  }

  /** Sends the stored file: streamed from disk when local, redirected to the provider otherwise. */
  private sendFile(res: Response, document: any) {
    res.setHeader("Cache-Control", "private, no-store");

    if (document.storageProvider !== "local") {
      return res.redirect(document.url);
    }

    const filePath = this.storageService.resolvePath(document.entityType, document.fileName);
    return res.download(filePath, document.originalName, (err) => {
      if (err && !res.headersSent) {
        const error = createErrorResponse("File not found on storage", HttpStatus.NOT_FOUND);
        res.status(error.statusCode).json(error.toJSON());
      }
    });
  }

  async getAll(req: Request, res: Response) {
    const flag = (value: unknown) => (value === "true" ? true : value === "false" ? false : undefined);
    const expiry = req.query.expiry;

    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      accountId: req.query.accountId as string,
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      documentType: req.query.documentType as string,
      status: req.query.status as string,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      tags:
        typeof req.query.tags === "string"
          ? req.query.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
      isVerified: flag(req.query.isVerified),
      expiry: expiry === "expired" || expiry === "expiring" ? expiry : undefined,
      sort: typeof req.query.sort === "string" ? req.query.sort : undefined,
    } as const;

    const result = await this.documentService.findAll(filters);

    const response = createPaginatedResponse(
      result.data,
      result.pagination.page,
      result.pagination.limit,
      result.pagination.total,
      "Documents retrieved successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getStats(_req: Request, res: Response) {
    const stats = await this.documentService.getStats();
    const response = createSuccessResponse(stats, "Document statistics retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getExpiring(req: Request, res: Response) {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 30));
    const documents = await this.documentService.findExpiringSoon(days);
    const labelled = await this.documentService.withEntityLabels(documents);
    const response = createSuccessResponse(labelled, "Expiring documents retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getByEntity(req: Request, res: Response) {
    const { entityType, entityId } = req.params;
    const documents = await this.documentService.findByEntity(entityType, entityId, {
      type: req.query.type as string,
      includeDeleted: req.query.includeDeleted === "true",
    });

    const response = createSuccessResponse(documents, "Documents retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const document = await this.documentService.findById(id);

    if (!document) {
      const error = createErrorResponse("Document not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(document, "Document retrieved successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async upload(req: ValidatedRequest<any>, res: Response) {
    const file = req.file;
    if (!file) {
      const error = createErrorResponse("No file was uploaded", HttpStatus.BAD_REQUEST);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const data = req.validated;
    const subfolder = data.entityType as string;

    const stored = await this.storageService.saveFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      subfolder,
    );

    const document = await this.documentService.create({
      tenantId: data.tenantId,
      accountId: data.accountId ?? req.user?.id,
      originalName: stored.originalName,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      size: stored.size,
      extension: stored.extension,
      storageProvider: stored.storageProvider,
      url: stored.url,
      path: stored.path,
      entityType: data.entityType,
      entityId: data.entityId,
      documentType: data.documentType,
      description: data.description,
      tags: data.tags,
      isPublic: data.isPublic,
      allowedRoles: data.allowedRoles,
      allowedAccounts: data.allowedAccounts,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
      metadata: data.metadata,
    });

    const response = createSuccessResponse(
      document,
      "Document uploaded successfully",
      HttpStatus.CREATED,
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async update(req: ValidatedRequest<any>, res: Response) {
    const { id } = req.params;
    const existing = await this.documentService.findById(id);
    if (!existing) {
      const error = createErrorResponse("Document not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }
    if (!(await this.canManage(req, existing))) return this.forbidden(res);

    const data = req.validated;
    const updates: any = { ...data };
    if (data.validFrom) updates.validFrom = new Date(data.validFrom);
    if (data.validUntil) updates.validUntil = new Date(data.validUntil);

    const document = await this.documentService.update(id, updates);
    if (!document) {
      const error = createErrorResponse("Document not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    const response = createSuccessResponse(document, "Document updated successfully");
    return res.status(response.statusCode).json(response.toJSON());
  }

  async verify(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const document = await this.documentService.verify(id, req.user!.id);
      const response = createSuccessResponse(document, "Document verified successfully");
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Document not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async archive(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await this.documentService.findById(id);
    if (existing && !(await this.canManage(req, existing))) return this.forbidden(res);
    try {
      const document = await this.documentService.archive(id);
      const response = createSuccessResponse(document, "Document archived successfully");
      return res.status(response.statusCode).json(response.toJSON());
    } catch (error: any) {
      if (error.message === "Document not found") {
        const apiError = createErrorResponse(error.message, HttpStatus.NOT_FOUND);
        return res.status(apiError.statusCode).json(apiError.toJSON());
      }
      throw error;
    }
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const document = await this.documentService.findById(id);
    if (!document) {
      const error = createErrorResponse("Document not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (!(await this.canManage(req, document))) return this.forbidden(res);

    await this.documentService.softDelete(id, req.user!.id);
    await this.storageService
      .deleteFile(document.entityType, document.fileName)
      .catch(() => undefined);

    const response = createSuccessResponse(
      { id: document._id, deleted: true },
      "Document deleted successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  async download(req: Request, res: Response) {
    const { id } = req.params;
    const document = await this.documentService.findById(id);

    if (!document) {
      const error = createErrorResponse("Document not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (req.user && !this.canRead(req, document)) {
      const error = createErrorResponse(
        "You don't have access to this document",
        HttpStatus.FORBIDDEN,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    return this.sendFile(res, document);
  }

  /**
   * Issues a short-lived link to the file.
   *
   * Browsers can't send a bearer token on `<a href>` / `window.open`, so the
   * authenticated `download` route can't be linked to. This runs the same
   * access check once, then returns a path that `downloadByToken` honours
   * without a session for a few minutes.
   */
  async createLink(req: Request, res: Response) {
    const { id } = req.params;
    const document = await this.documentService.findById(id);

    if (!document) {
      const error = createErrorResponse("Document not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (!this.canRead(req, document)) {
      const error = createErrorResponse(
        "You don't have access to this document",
        HttpStatus.FORBIDDEN,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const { token, expiresAt } = signDocumentLink({
      documentId: String(document._id),
      tenantId: document.tenantId ? String(document.tenantId) : undefined,
    });

    const response = createSuccessResponse(
      {
        path: `/api/v1/documents/download/${token}`,
        fileName: document.originalName,
        expiresAt,
      },
      "Download link created successfully",
    );
    return res.status(response.statusCode).json(response.toJSON());
  }

  /** Unauthenticated: the signed token is the credential. See `createLink`. */
  async downloadByToken(req: Request, res: Response) {
    const payload = verifyDocumentLink(req.params.token);
    if (!payload) {
      const error = createErrorResponse(
        "This download link is invalid or has expired",
        HttpStatus.UNAUTHORIZED,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    // The tenant is named in the query because this route has no session to
    // scope by; without it the tenant plugin would see an empty context.
    const filter: Record<string, unknown> = { _id: payload.documentId, isDeleted: false };
    if (payload.tenantId) filter.tenantId = payload.tenantId;
    const document = await Document.findOne(filter);

    if (!document) {
      const error = createErrorResponse("Document not found", HttpStatus.NOT_FOUND);
      return res.status(error.statusCode).json(error.toJSON());
    }

    return this.sendFile(res, document);
  }
}
