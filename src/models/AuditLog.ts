// models/AuditLog.js
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { tenantPlugin } from '../middleware/tenant/tenantPlugin';

export interface IAuditLog extends Document {
  tenantId?: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole?: 'owner' | 'staff' | 'admin' | 'fleet_manager' | 'service_advisor' | 'system';
  actorEmail?: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'GRANT_ACCESS' | 'REVOKE_ACCESS';
  entityType: 'Vehicle' | 'ServiceRecord' | 'Account' | 'OwnerProfile' | 'StaffProfile' | 'ServiceCenter' | 'Tenant' | 'System';
  entityId: Types.ObjectId;
  changes: Types.DocumentArray<{
    field?: string;
    oldValue?: any;
    newValue?: any;
  }>;
  ipAddress?: string;
  userAgent?: string;
  /** HTTP status the request ended with. Absent on entries written before it was recorded. */
  statusCode?: number;
  /** The request path, e.g. `/api/v1/admin/tenants/abc/approve`. */
  path?: string;
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
    // Every account role, not just three of them: an entry for a
    // `fleet_manager` or `service_advisor` failed enum validation and was
    // dropped (only logged), so those users' actions never reached the trail.
    enum: ['owner', 'staff', 'admin', 'fleet_manager', 'service_advisor', 'system']
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
    enum: ['Vehicle', 'ServiceRecord', 'Account', 'OwnerProfile', 'StaffProfile', 'ServiceCenter', 'Tenant', 'System']
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
  statusCode: Number,
  path: String,

  recordedAt: { type: Date, default: Date.now }

}, { timestamps: true });

auditLogSchema.index({ tenantId: 1, recordedAt: -1 });
auditLogSchema.index({ actorId: 1, recordedAt: -1 });
auditLogSchema.index({ entityId: 1, recordedAt: -1 });
auditLogSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

auditLogSchema.plugin(tenantPlugin);

export const AuditLog = mongoose.model<IAuditLog, IAuditLogModel>('AuditLog', auditLogSchema);
