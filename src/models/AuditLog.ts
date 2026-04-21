// models/AuditLog.js
const { mongoose, Schema } = require('../config/database');

const auditLogSchema = new Schema({
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

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);