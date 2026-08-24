// models/StaffProfile.js
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { tenantPlugin } from '../middleware/tenant/tenantPlugin';

export interface IStaffProfile extends Document {
  accountId: Types.ObjectId;
  serviceCenterId: Types.ObjectId;
  employeeId?: string;
  roleId: Types.ObjectId;
  customPermissions: Types.DocumentArray<{
    permission?: Types.ObjectId;
    grantedBy?: Types.ObjectId;
    grantedAt: Date;
    expiresAt?: Date;
    reason?: string;
  }>;
  deniedPermissions: Types.DocumentArray<{
    permission?: Types.ObjectId;
    deniedBy?: Types.ObjectId;
    deniedAt: Date;
    expiresAt?: Date;
    reason?: string;
  }>;
  employmentStatus: 'active' | 'on_leave' | 'suspended' | 'terminated';
  employmentType: 'full_time' | 'part_time' | 'contractor' | 'intern';
  joinedAt: Date;
  leftAt?: Date;
  workSchedule?: Record<string, { start?: string; end?: string; available?: boolean }>;
  skills: {
    name?: string;
    level?: 'beginner' | 'intermediate' | 'expert';
    certified?: boolean;
    certificationExpiry?: Date;
    yearsOfExperience?: number;
  }[];
  specializations: string[];
  averageRating: number;
  totalReviews: number;
  stats: {
    totalServicesPerformed: number;
    totalRevenueGenerated: number;
    customerSatisfaction: number;
  };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  can(permissionKey: string, resourceId?: string | Types.ObjectId | null): Promise<boolean>;
  canAccessResource(permissionKey: string, resourceId: string | Types.ObjectId): Promise<boolean>;
  getPermissions(): Promise<string[]>;
  isAdmin(): Promise<boolean>;
  isManager(): Promise<boolean>;
}

export interface IStaffProfileModel extends Model<IStaffProfile> {
  findByAccount(accountId: string | Types.ObjectId): mongoose.Query<IStaffProfile | null, IStaffProfile>;
  findByServiceCenter(
    centerId: string | Types.ObjectId,
    options?: { roleId?: string | Types.ObjectId; status?: string; sort?: any },
  ): mongoose.Query<IStaffProfile[], IStaffProfile>;
}

const staffProfileSchema = new Schema<IStaffProfile, IStaffProfileModel>({
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
    expiresAt: Date,
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
staffProfileSchema.methods.can = async function (this: IStaffProfile, permissionKey: string, resourceId: string | Types.ObjectId | null = null) {
  // Check denied permissions first (exceptions)
  const isDenied = this.deniedPermissions.some((dp) => {
    if (dp.expiresAt && dp.expiresAt < new Date()) return false;
    return (dp.permission as unknown as { key: string })?.key === permissionKey;
  });
  if (isDenied) return false;

  // Check custom permissions
  const hasCustom = this.customPermissions.some((cp) => {
    if (cp.expiresAt && cp.expiresAt < new Date()) return false;
    return (cp.permission as unknown as { key: string })?.key === permissionKey;
  });
  if (hasCustom) return true;

  // Check role permissions
  await this.populate('roleId');
  if (!this.roleId) return false;

  const role = this.roleId as unknown as { hasPermission(key: string): Promise<boolean> };
  const hasRolePerm = await role.hasPermission(permissionKey);
  if (!hasRolePerm) return false;

  // Resource-level check (if provided)
  if (resourceId) {
    return await this.canAccessResource(permissionKey, resourceId);
  }

  return true;
};

// Check resource ownership/scope
staffProfileSchema.methods.canAccessResource = async function (this: IStaffProfile, permissionKey: string, resourceId: string | Types.ObjectId) {
  const [resource] = permissionKey.split(':');

  switch (resource) {
    case 'vehicle': {
      const Vehicle = mongoose.model('Vehicle');
      const vehicle = await Vehicle.findById(resourceId);
      if (!vehicle) return false;

      // Staff can access if vehicle is authorized for their center
      return vehicle.authorizedServiceCenters.some(
        (asc: any) => asc.serviceCenterId?.toString() === this.serviceCenterId.toString() &&
               asc.status === 'active'
      );
    }

    case 'service_record': {
      const ServiceRecord = mongoose.model('ServiceRecord');
      const record = await ServiceRecord.findById(resourceId);
      if (!record) return false;

      // Can access if record belongs to their center
      return (record as any).serviceCenterId.toString() === this.serviceCenterId.toString();
    }

    case 'staff_profile': {
      // Can only access staff in same center
      const StaffProfileModel = this.constructor as IStaffProfileModel;
      const staff = await StaffProfileModel.findById(resourceId);
      if (!staff) return false;
      return staff.serviceCenterId.toString() === this.serviceCenterId.toString();
    }

    default:
      return true; // No resource-level restriction
  }
};

// Get all effective permissions
staffProfileSchema.methods.getPermissions = async function (this: IStaffProfile) {
  await this.populate('roleId');

  const role = this.roleId as unknown as { getAllPermissions(): Promise<string[]> };
  let permissions = await role.getAllPermissions();

  // Add custom permissions
  await this.populate('customPermissions.permission');
  const customPerms = this.customPermissions
    .filter((cp) => !cp.expiresAt || cp.expiresAt > new Date())
    .map((cp) => (cp.permission as unknown as { key: string })?.key)
    .filter((key): key is string => !!key);
  permissions = [...new Set([...permissions, ...customPerms])];

  // Remove denied permissions
  await this.populate('deniedPermissions.permission');
  const deniedPerms = this.deniedPermissions
    .filter((dp) => !dp.expiresAt || dp.expiresAt > new Date())
    .map((dp) => (dp.permission as unknown as { key: string })?.key)
    .filter((key): key is string => !!key);
  permissions = permissions.filter((p) => !deniedPerms.includes(p));

  return permissions;
};

// Quick check methods
staffProfileSchema.methods.isAdmin = async function (this: IStaffProfile) {
  await this.populate('roleId');
  const role = this.roleId as unknown as { level: number };
  return role.level <= 10; // Admin or Tenant Admin
};

staffProfileSchema.methods.isManager = async function (this: IStaffProfile) {
  await this.populate('roleId');
  const role = this.roleId as unknown as { level: number };
  return role.level <= 20;
};

// Static methods
staffProfileSchema.statics.findByAccount = function (this: IStaffProfileModel, accountId: string | Types.ObjectId) {
  return this.findOne({ accountId, isDeleted: false })
    .populate('roleId')
    .populate('serviceCenter', 'name email phone address');
};

staffProfileSchema.statics.findByServiceCenter = function (
  this: IStaffProfileModel,
  centerId: string | Types.ObjectId,
  options: { roleId?: string | Types.ObjectId; status?: string; sort?: any } = {},
) {
  const query: any = {
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

staffProfileSchema.plugin(tenantPlugin);

export const StaffProfile = mongoose.model<IStaffProfile, IStaffProfileModel>('StaffProfile', staffProfileSchema);
