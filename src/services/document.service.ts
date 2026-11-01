import { Document } from "../models/Document";
import { Vehicle } from "../models/Vehicle";
import { ServiceCenter } from "../models/ServiceCenter";
import { Invoice } from "../models/Invoice";
import mongoose from "mongoose";

const EXPIRING_SOON_DAYS = 30;
const MAX_PAGE_SIZE = 100;

const SORTABLE_FIELDS = new Set(["createdAt", "validUntil", "size", "originalName"]);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `-createdAt` → `{ createdAt: -1 }`; anything not allow-listed falls back to newest first. */
function parseSort(sort: string | undefined): Record<string, 1 | -1> {
  if (!sort) return { createdAt: -1 };
  const desc = sort.startsWith("-");
  const field = desc ? sort.slice(1) : sort;
  return SORTABLE_FIELDS.has(field) ? { [field]: desc ? -1 : 1 } : { createdAt: -1 };
}

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
  /** Free text over file name, description and tags. */
  q?: string;
  tags?: string[];
  isVerified?: boolean;
  /** `expired` = past `validUntil`; `expiring` = within the next 30 days. */
  expiry?: "expired" | "expiring";
  sort?: string;
}

export interface DocumentStats {
  total: number;
  totalBytes: number;
  unverified: number;
  expired: number;
  expiringSoon: number;
  byType: Record<string, number>;
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
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters?.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.accountId) query.accountId = filters.accountId;
    if (filters?.entityType) query.entityType = filters.entityType;
    if (filters?.entityId) query.entityId = filters.entityId;
    if (filters?.documentType) query.documentType = filters.documentType;
    if (filters?.status) query.status = filters.status;
    if (filters?.isVerified !== undefined) query.isVerified = filters.isVerified;
    if (filters?.tags?.length) query.tags = { $in: filters.tags };

    if (filters?.q?.trim()) {
      const pattern = new RegExp(escapeRegex(filters.q.trim()), "i");
      query.$or = [{ originalName: pattern }, { description: pattern }, { tags: pattern }];
    }

    // Expiry is read from `validUntil` directly. The stored `isExpired` flag
    // is only recomputed on save, so it goes stale the day after a document
    // is written and can't be trusted to filter on.
    const now = new Date();
    if (filters?.expiry === "expired") {
      query.validUntil = { $lt: now };
    } else if (filters?.expiry === "expiring") {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() + EXPIRING_SOON_DAYS);
      query.validUntil = { $gte: now, $lte: cutoff };
    }

    const [documents, total] = await Promise.all([
      Document.find(query).sort(parseSort(filters?.sort)).skip(skip).limit(limit),
      Document.countDocuments(query),
    ]);

    return {
      data: await this.withEntityLabels(documents),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Adds `entityLabel` ("MH12 AB 1234 · Honda City") so a list can say what a
   * document is attached to without the client fetching every entity.
   *
   * Replaces a `.populate("entityId")` that could never have worked:
   * `entityId` has no `ref` (it points at a different collection depending
   * on `entityType`), so there was nothing for populate to resolve against.
   * One batched lookup per entity type, and only for types that have a
   * sensible display name — the rest simply get no label.
   */
  async withEntityLabels(documents: any[]): Promise<any[]> {
    const idsByType = new Map<string, Set<string>>();
    for (const doc of documents) {
      const set = idsByType.get(doc.entityType) ?? new Set<string>();
      set.add(String(doc.entityId));
      idsByType.set(doc.entityType, set);
    }

    const labels = new Map<string, string>();
    const key = (type: string, id: unknown) => `${type}:${String(id)}`;
    const idsOf = (type: string) => [...(idsByType.get(type) ?? [])];

    await Promise.all([
      idsByType.has("vehicle")
        ? Vehicle.find({ _id: { $in: idsOf("vehicle") } })
            .select("registrationNumber make model")
            .lean()
            .then((rows: any[]) =>
              rows.forEach((v) =>
                labels.set(key("vehicle", v._id), `${v.registrationNumber} · ${v.make} ${v.model}`),
              ),
            )
        : undefined,
      idsByType.has("service_center")
        ? ServiceCenter.find({ _id: { $in: idsOf("service_center") } })
            .select("name")
            .lean()
            .then((rows: any[]) => rows.forEach((c) => labels.set(key("service_center", c._id), c.name)))
        : undefined,
      idsByType.has("invoice")
        ? Invoice.find({ _id: { $in: idsOf("invoice") } })
            .select("invoiceNumber")
            .lean()
            .then((rows: any[]) =>
              rows.forEach((i) => labels.set(key("invoice", i._id), `Invoice ${i.invoiceNumber}`)),
            )
        : undefined,
    ]);

    const now = Date.now();
    return documents.map((doc) => {
      const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
      return {
        ...plain,
        entityLabel: labels.get(key(doc.entityType, doc.entityId)),
        // Derived on every read: the stored flag only updates on save.
        isExpired: plain.validUntil ? new Date(plain.validUntil).getTime() < now : false,
      };
    });
  }

  async getStats(): Promise<DocumentStats> {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + EXPIRING_SOON_DAYS);

    const [totals, byType] = await Promise.all([
      Document.aggregate([
        { $match: { isDeleted: false, status: { $ne: "deleted" } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalBytes: { $sum: "$size" },
            unverified: { $sum: { $cond: [{ $eq: ["$isVerified", false] }, 1, 0] } },
            expired: {
              $sum: { $cond: [{ $and: [{ $ne: [{ $type: "$validUntil" }, "missing"] }, { $lt: ["$validUntil", now] }] }, 1, 0] },
            },
            expiringSoon: {
              $sum: { $cond: [{ $and: [{ $gte: ["$validUntil", now] }, { $lte: ["$validUntil", cutoff] }] }, 1, 0] },
            },
          },
        },
      ]),
      Document.aggregate([
        { $match: { isDeleted: false, status: { $ne: "deleted" } } },
        { $group: { _id: "$documentType", count: { $sum: 1 } } },
      ]),
    ]);

    const t = totals[0] ?? {};
    return {
      total: t.total ?? 0,
      totalBytes: t.totalBytes ?? 0,
      unverified: t.unverified ?? 0,
      expired: t.expired ?? 0,
      expiringSoon: t.expiringSoon ?? 0,
      byType: Object.fromEntries(byType.map((row: any) => [row._id, row.count])),
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
