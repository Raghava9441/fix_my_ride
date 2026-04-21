// models/Document.ts
import mongoose, { Schema } from 'mongoose';

export interface IDocument extends mongoose.Document {
  tenantId?: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId;
  
  // File Info
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  extension: string;
  
  // Storage
  storageProvider: 's3' | 'cloudinary' | 'local' | 'gcs' | 'azure';
  url: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  path?: string;
  bucket?: string;
  region?: string;
  
  // Entity Reference
  entityType: 'vehicle' | 'service_record' | 'service_center' | 'owner_profile' | 
              'staff_profile' | 'invoice' | 'subscription' | 'audit' | 'other';
  entityId: mongoose.Types.ObjectId;
  
  // Document Type
  documentType: 'registration' | 'insurance' | 'puc' | 'invoice' | 'warranty' | 
                'service_history' | 'photo' | 'video' | 'report' | 'contract' | 
                'id_proof' | 'certificate' | 'other';
  
  // Metadata
  description?: string;
  tags: string[];
  metadata: Record<string, any>;
  
  // Verification
  isVerified: boolean;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  
  // Access Control
  isPublic: boolean;
  allowedRoles: string[];
  allowedAccounts: mongoose.Types.ObjectId[];
  
  // Expiry
  validFrom?: Date;
  validUntil?: Date;
  isExpired: boolean;
  
  // Status
  status: 'active' | 'archived' | 'deleted' | 'processing' | 'failed';
  
  // Versioning
  version: number;
  previousVersionId?: mongoose.Types.ObjectId;
  isLatestVersion: boolean;
  
  // Soft Delete
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
}

const documentSchema = new Schema<IDocument>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account'
  },
  
  originalName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  extension: String,
  
  storageProvider: {
    type: String,
    enum: ['s3', 'cloudinary', 'local', 'gcs', 'azure'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: String,
  downloadUrl: String,
  path: String,
  bucket: String,
  region: String,
  
  entityType: {
    type: String,
    enum: [
      'vehicle', 'service_record', 'service_center', 'owner_profile',
      'staff_profile', 'invoice', 'subscription', 'audit', 'other'
    ],
    required: true,
    index: true
  },
  entityId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  documentType: {
    type: String,
    enum: [
      'registration', 'insurance', 'puc', 'invoice', 'warranty',
      'service_history', 'photo', 'video', 'report', 'contract',
      'id_proof', 'certificate', 'other'
    ],
    required: true
  },
  
  description: String,
  tags: [String],
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'StaffProfile'
  },
  verifiedAt: Date,
  
  isPublic: {
    type: Boolean,
    default: false
  },
  allowedRoles: [String],
  allowedAccounts: [{
    type: Schema.Types.ObjectId,
    ref: 'Account'
  }],
  
  validFrom: Date,
  validUntil: Date,
  isExpired: {
    type: Boolean,
    default: false
  },
  
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted', 'processing', 'failed'],
    default: 'active'
  },
  
  version: {
    type: Number,
    default: 1
  },
  previousVersionId: {
    type: Schema.Types.ObjectId,
    ref: 'Document'
  },
  isLatestVersion: {
    type: Boolean,
    default: true
  },
  
  deletedAt: Date,
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Account'
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }

}, {
  timestamps: true
});

// Indexes
documentSchema.index({ entityType: 1, entityId: 1, isDeleted: 1 });
documentSchema.index({ documentType: 1, status: 1 });
documentSchema.index({ tenantId: 1, createdAt: -1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });

// Pre-save: Check expiry
documentSchema.pre('save', function(next) {
  if (this.validUntil && this.validUntil < new Date()) {
    this.isExpired = true;
  }
  next();
});

// Methods
documentSchema.methods.verify = async function(verifiedBy: string): Promise<IDocument> {
  this.isVerified = true;
  this.verifiedBy = new mongoose.Types.ObjectId(verifiedBy);
  this.verifiedAt = new Date();
  return this.save();
};

documentSchema.methods.archive = async function(): Promise<IDocument> {
  this.status = 'archived';
  return this.save();
};

documentSchema.methods.softDelete = async function(deletedBy: string): Promise<IDocument> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = new mongoose.Types.ObjectId(deletedBy);
  this.status = 'deleted';
  return this.save();
};

documentSchema.methods.isAccessibleBy = function(accountId: string, role: string): boolean {
  if (this.isPublic) return true;
  if (this.allowedAccounts.some(id => id.toString() === accountId)) return true;
  if (this.allowedRoles.includes(role)) return true;
  return false;
};

// Static methods
documentSchema.statics.findByEntity = function(
  entityType: string,
  entityId: string,
  options: { type?: string; includeDeleted?: boolean } = {}
) {
  const query: any = { entityType, entityId };
  if (options.type) query.documentType = options.type;
  if (!options.includeDeleted) query.isDeleted = false;
  
  return this.find(query).sort({ createdAt: -1 });
};

documentSchema.statics.findExpiringSoon = function(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  
  return this.find({
    validUntil: { $lte: cutoff, $gte: new Date() },
    isDeleted: false,
    status: 'active'
  }).populate('entityId');
};

export const Document = mongoose.model<IDocument>('Document', documentSchema);