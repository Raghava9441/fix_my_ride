import { Document } from "../models/Document";
import mongoose from "mongoose";

export interface CreateDocumentInput {
  tenantId?: string;
  accountId?: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  extension?: string;
  storageProvider: "s3" | "cloudinary" | "local" | "gcs" | "azure";
  url: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  path?: string;
  bucket?: string;
  region?: string;
  entityType:
    | "vehicle"
    | "service_record"
    | "service_center"
    | "owner_profile"
    | "staff_profile"
    | "invoice"
    | "subscription"
    | "audit"
    | "other";
  entityId: string;
  documentType:
    | "registration"
    | "insurance"
    | "puc"
    | "invoice"
    | "warranty"
    | "service_history"
    | "photo"
    | "video"
    | "report"
    | "contract"
    | "id_proof"
    | "certificate"
    | "other";
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  isPublic?: boolean;
  allowedRoles?: string[];
  allowedAccounts?: string[];
  validFrom?: Date;
  validUntil?: Date;
}

export interface DocumentFilters {
  page?: number;
  limit?: number;
  tenantId?: string;
  accountId?: string;
  entityType?: string;
  entityId?: string;
  documentType?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class DocumentService {
  async findAll(filters?: DocumentFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.accountId) query.accountId = filters.accountId;
    if (filters?.entityType) query.entityType = filters.entityType;
    if (filters?.entityId) query.entityId = filters.entityId;
    if (filters?.documentType) query.documentType = filters.documentType;
    if (filters?.status) query.status = filters.status;

    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate("entityId", "name registrationNumber")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Document.countDocuments(query),
    ]);

    return {
      data: documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Document.findById(id);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    options?: { type?: string; includeDeleted?: boolean },
  ): Promise<any[]> {
    return Document.findByEntity(entityType, entityId, options);
  }

  async create(input: CreateDocumentInput): Promise<any> {
    const document = await Document.create({
      tenantId: input.tenantId
        ? new mongoose.Types.ObjectId(input.tenantId)
        : undefined,
      accountId: input.accountId
        ? new mongoose.Types.ObjectId(input.accountId)
        : undefined,
      originalName: input.originalName,
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.size,
      extension: input.extension,
      storageProvider: input.storageProvider,
      url: input.url,
      thumbnailUrl: input.thumbnailUrl,
      downloadUrl: input.downloadUrl,
      path: input.path,
      bucket: input.bucket,
      region: input.region,
      entityType: input.entityType,
      entityId: new mongoose.Types.ObjectId(input.entityId),
      documentType: input.documentType,
      description: input.description,
      tags: input.tags || [],
      metadata: input.metadata || {},
      isVerified: false,
      isPublic: input.isPublic || false,
      allowedRoles: input.allowedRoles || [],
      allowedAccounts:
        input.allowedAccounts?.map((id) => new mongoose.Types.ObjectId(id)) ||
        [],
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      status: "active",
      version: 1,
      isLatestVersion: true,
      isDeleted: false,
    });

    return document;
  }

  async update(
    id: string,
    updates: {
      description?: string;
      tags?: string[];
      metadata?: Record<string, any>;
      validFrom?: Date;
      validUntil?: Date;
    },
  ): Promise<any | null> {
    const document = await Document.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    return document;
  }

  async verify(id: string, verifiedBy: string): Promise<any> {
    const document = await Document.findById(id);
    if (!document) {
      throw new Error("Document not found");
    }

    return document.verify(verifiedBy);
  }

  async archive(id: string): Promise<any> {
    const document = await Document.findById(id);
    if (!document) {
      throw new Error("Document not found");
    }

    return document.archive();
  }

  async softDelete(id: string, deletedBy: string): Promise<any> {
    const document = await Document.findById(id);
    if (!document) {
      throw new Error("Document not found");
    }

    return document.softDelete(deletedBy);
  }

  async delete(id: string): Promise<any | null> {
    const document = await Document.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date(), status: "deleted" } },
      { new: true },
    );

    return document;
  }

  async isAccessibleBy(
    documentId: string,
    accountId: string,
    role: string,
  ): Promise<boolean> {
    const document = await Document.findById(documentId);
    if (!document) {
      return false;
    }

    return document.isAccessibleBy(accountId, role);
  }

  async findExpiringSoon(days: number = 30): Promise<any[]> {
    return Document.findExpiringSoon(days);
  }

  async findByTags(tags: string[]): Promise<any[]> {
    return Document.find({
      tags: { $in: tags },
      isDeleted: false,
      status: "active",
    }).sort({ createdAt: -1 });
  }

  async getByType(documentType: string): Promise<any[]> {
    return Document.find({
      documentType,
      isDeleted: false,
      status: "active",
    }).sort({ createdAt: -1 });
  }
}

export const documentService = new DocumentService();
