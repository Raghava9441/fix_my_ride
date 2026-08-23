// models/AuditLog.js
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { tenantPlugin } from '../middleware/tenant/tenantPlugin';

export interface IAuditLog extends Document {
  tenantId?: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole?: 'owner' | 'staff' | 'admin' | 'system';
  actorEmail?: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'GRANT_ACCESS' | 'REVOKE_ACCESS';
  entityType: 'Vehicle' | 'ServiceRecord' | 'Account' | 'OwnerProfile' | 'StaffProfile' | 'ServiceCenter';
  entityId: Types.ObjectId;
  changes: Types.DocumentArray<{
    field?: string;
    oldValue?: any;
    newValue?: any;
  }>;
  ipAddress?: string;
  userAgent?: string;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLogModel extends Model<IAuditLog> {}

const auditLogSchema = new Schema<IAuditLog, IAuditLogModel>({
  tenantId: Schema.Types.ObjectId,

  // Actor (Account)
  actorId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  actorRole: {
    type: String,
    enum: ['owner', 'staff', 'admin', 'system']
  },
  actorEmail: String,

  // Action
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'GRANT_ACCESS', 'REVOKE_ACCESS']
  },
  entityType: {
    type: String,
    required: true,
    enum: ['Vehicle', 'ServiceRecord', 'Account', 'OwnerProfile', 'StaffProfile', 'ServiceCenter']
  },
  entityId: { type: Schema.Types.ObjectId, required: true },

  // Details
  changes: [{
    field: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed
  }],

  // Context
  ipAddress: String,
  userAgent: String,

  recordedAt: { type: Date, default: Date.now }

}, { timestamps: true });

auditLogSchema.index({ tenantId: 1, recordedAt: -1 });
auditLogSchema.index({ actorId: 1, recordedAt: -1 });
auditLogSchema.index({ entityId: 1, recordedAt: -1 });
auditLogSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

auditLogSchema.plugin(tenantPlugin);

export const AuditLog = mongoose.model<IAuditLog, IAuditLogModel>('AuditLog', auditLogSchema);
