// models/StaffProfile.js
import mongoose, { Schema } from "mongoose";

const staffProfileSchema = new Schema({
  // Link to Account
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    unique: true,
    index: true
  },
  
  // Employment
  serviceCenterId: {
    type: Schema.Types.ObjectId,
    ref: 'ServiceCenter',
    required: true,
    index: true
  },
  employeeId: String,
  
  // RBAC: Reference to Role (instead of hardcoded role string)
  roleId: {
    type: Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  
  // Override permissions (additive only)
  customPermissions: [{
    permission: { type: Schema.Types.ObjectId, ref: 'Permission' },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    reason: String
  }],
  
  // Denied permissions (exceptions)
  deniedPermissions: [{
    permission: { type: Schema.Types.ObjectId, ref: 'Permission' },
    deniedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
    deniedAt: { type: Date, default: Date.now },
    reason: String
  }],
  
  // Employment Status
  employmentStatus: {
    type: String,
    enum: ['active', 'on_leave', 'suspended', 'terminated'],
    default: 'active'
  },
  employmentType: {
    type: String,
    enum: ['full_time', 'part_time', 'contractor', 'intern'],
    default: 'full_time'
  },
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date,
  
  // Schedule
  workSchedule: {
    monday: { start: String, end: String, available: Boolean },
    tuesday: { start: String, end: String, available: Boolean },
    wednesday: { start: String, end: String, available: Boolean },
    thursday: { start: String, end: String, available: Boolean },
    friday: { start: String, end: String, available: Boolean },
    saturday: { start: String, end: String, available: Boolean },
    sunday: { start: String, end: String, available: Boolean }
  },
  
  // Skills & Performance
  skills: [{
    name: String,
    level: { type: String, enum: ['beginner', 'intermediate', 'expert'] },
    certified: Boolean,
    certificationExpiry: Date,
    yearsOfExperience: Number
  }],
  specializations: [String],
  averageRating: { type: Number, min: 0, max: 5, default: 0 },
  totalReviews: { type: Number, default: 0 },
  
  // Statistics
  stats: {
    totalServicesPerformed: { type: Number, default: 0 },
    totalRevenueGenerated: { type: Number, default: 0 },
    customerSatisfaction: { type: Number, default: 0 }
  },

  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

// Indexes
staffProfileSchema.index({ accountId: 1 });
staffProfileSchema.index({ serviceCenterId: 1, employmentStatus: 1 });
staffProfileSchema.index({ roleId: 1 });

// Virtuals
staffProfileSchema.virtual('account', {
  ref: 'Account',
  localField: 'accountId',
  foreignField: '_id',
  justOne: true
});

staffProfileSchema.virtual('serviceCenter', {
  ref: 'ServiceCenter',
  localField: 'serviceCenterId',
  foreignField: '_id',
  justOne: true
});

staffProfileSchema.virtual('role', {
  ref: 'Role',
  localField: 'roleId',
  foreignField: '_id',
  justOne: true
});

// CRITICAL: Permission checking method
staffProfileSchema.methods.can = async function(permissionKey, resourceId = null) {
  // Check denied permissions first (exceptions)
  const isDenied = this.deniedPermissions.some(dp => {
    if (dp.expiresAt && dp.expiresAt < new Date()) return false;
    return dp.permission.key === permissionKey;
  });
  if (isDenied) return false;
  
  // Check custom permissions
  const hasCustom = this.customPermissions.some(cp => {
    if (cp.expiresAt && cp.expiresAt < new Date()) return false;
    return cp.permission.key === permissionKey;
  });
  if (hasCustom) return true;
  
  // Check role permissions
  await this.populate('roleId');
  if (!this.roleId) return false;
  
  const hasRolePerm = await this.roleId.hasPermission(permissionKey);
  if (!hasRolePerm) return false;
  
  // Resource-level check (if provided)
  if (resourceId) {
    return await this.canAccessResource(permissionKey, resourceId);
  }
  
  return true;
};

// Check resource ownership/scope
staffProfileSchema.methods.canAccessResource = async function(permissionKey, resourceId) {
  const [resource] = permissionKey.split(':');
  
  switch (resource) {
    case 'vehicle':
      const Vehicle = mongoose.model('Vehicle');
      const vehicle = await Vehicle.findById(resourceId);
      if (!vehicle) return false;
      
      // Staff can access if vehicle is authorized for their center
      return vehicle.authorizedServiceCenters.some(
        asc => asc.serviceCenterId.toString() === this.serviceCenterId.toString() &&
               asc.status === 'active'
      );
      
    case 'service_record':
      const ServiceRecord = mongoose.model('ServiceRecord');
      const record = await ServiceRecord.findById(resourceId);
      if (!record) return false;
      
      // Can access if record belongs to their center
      return record.serviceCenterId.toString() === this.serviceCenterId.toString();
      
    case 'staff_profile':
      // Can only access staff in same center
      const staff = await this.constructor.findById(resourceId);
      if (!staff) return false;
      return staff.serviceCenterId.toString() === this.serviceCenterId.toString();
      
    default:
      return true; // No resource-level restriction
  }
};

// Get all effective permissions
staffProfileSchema.methods.getPermissions = async function() {
  await this.populate('roleId');
  
  let permissions = await this.roleId.getAllPermissions();
  
  // Add custom permissions
  await this.populate('customPermissions.permission');
  const customPerms = this.customPermissions
    .filter(cp => !cp.expiresAt || cp.expiresAt > new Date())
    .map(cp => cp.permission.key);
  permissions = [...new Set([...permissions, ...customPerms])];
  
  // Remove denied permissions
  await this.populate('deniedPermissions.permission');
  const deniedPerms = this.deniedPermissions
    .filter(dp => !dp.expiresAt || dp.expiresAt > new Date())
    .map(dp => dp.permission.key);
  permissions = permissions.filter(p => !deniedPerms.includes(p));
  
  return permissions;
};

// Quick check methods
staffProfileSchema.methods.isAdmin = async function() {
  await this.populate('roleId');
  return this.roleId.level <= 10; // Admin or Tenant Admin
};

staffProfileSchema.methods.isManager = async function() {
  await this.populate('roleId');
  return this.roleId.level <= 20;
};

// Static methods
staffProfileSchema.statics.findByAccount = function(accountId) {
  return this.findOne({ accountId, isDeleted: false })
    .populate('roleId')
    .populate('serviceCenter', 'name email phone address');
};

staffProfileSchema.statics.findByServiceCenter = function(centerId, options = {}) {
  const query = { 
    serviceCenterId: centerId, 
    isDeleted: false,
    employmentStatus: { $ne: 'terminated' }
  };
  
  if (options.roleId) query.roleId = options.roleId;
  if (options.status) query.employmentStatus = options.status;
  
  return this.find(query)
    .populate('account', 'email phone status lastLoginAt')
    .populate('roleId', 'name slug level')
    .sort(options.sort || { joinedAt: -1 });
};

export const StaffProfile = mongoose.model('StaffProfile', staffProfileSchema);