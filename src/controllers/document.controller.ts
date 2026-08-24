import { Request, Response } from "express";
import { ValidatedRequest } from "../middleware/validation.middleware";
import { DocumentService } from "../services/document.service";
import { StorageService } from "../services/storage.service";
import {
  HttpStatus,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from "../utils";

export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly storageService: StorageService,
  ) {}

  async getAll(req: Request, res: Response) {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      accountId: req.query.accountId as string,
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      documentType: req.query.documentType as string,
      status: req.query.status as string,
    };

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

    if (
      req.user &&
      !document.isAccessibleBy(req.user.id, req.user.role) &&
      !req.user.roles?.includes("admin")
    ) {
      const error = createErrorResponse(
        "You don't have access to this document",
        HttpStatus.FORBIDDEN,
      );
      return res.status(error.statusCode).json(error.toJSON());
    }

    const filePath = this.storageService.resolvePath(document.entityType, document.fileName);
    return res.download(filePath, document.originalName, (err) => {
      if (err && !res.headersSent) {
        const error = createErrorResponse("File not found on storage", HttpStatus.NOT_FOUND);
        res.status(error.statusCode).json(error.toJSON());
      }
    });
  }
}
