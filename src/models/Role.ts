import mongoose, { Schema } from "mongoose";

const roleSchema = new Schema({
  // Identity
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  description: String,
  
  // Role Type
  type: {
    type: String,
    enum: ['system', 'tenant', 'custom'],
    default: 'custom'
  },
  
  // For tenant-specific roles
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  
  // Service center specific custom roles
  serviceCenterId: {
    type: Schema.Types.ObjectId,
    ref: 'ServiceCenter'
  },
  
  // Hierarchy level (lower = more powerful)
  level: {
    type: Number,
    default: 100,
    min: 0,
    max: 1000
  },
  
  // Permissions
  permissions: [{
    type: Schema.Types.ObjectId,
    ref: 'Permission'
  }],
  
  // Inherited roles (cascading permissions)
  inheritsFrom: [{
    type: Schema.Types.ObjectId,
    ref: 'Role'
  }],
  
  // UI/UX
  color: { type: String, default: '#6B7280' },
  icon: String,
  
  // Limits
  maxUsers: { type: Number, default: 0 }, // 0 = unlimited
  
  // Status
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }, // Auto-assign to new users
  
  // Metadata
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Account'
  }

}, { timestamps: true });

// Indexes
roleSchema.index({ tenantId: 1, slug: 1 }, { unique: true, sparse: true });
roleSchema.index({ serviceCenterId: 1, slug: 1 }, { unique: true, sparse: true });
roleSchema.index({ type: 1, level: 1 });

// Pre-validate: ensure unique slug per scope
roleSchema.pre('validate', async function(next) {
  if (this.type === 'system') {
    this.tenantId = undefined;
    this.serviceCenterId = undefined;
  }
  next();
});

// Methods
roleSchema.methods.getAllPermissions = async function() {
  // Get direct permissions
  await this.populate('permissions');
  let allPerms = new Set(this.permissions.map(p => p.key));
  
  // Get inherited permissions
  if (this.inheritsFrom?.length > 0) {
    await this.populate('inheritsFrom');
    for (const parentRole of this.inheritsFrom) {
      const parentPerms = await parentRole.getAllPermissions();
      parentPerms.forEach(p => allPerms.add(p));
    }
  }
  
  return Array.from(allPerms);
};

roleSchema.methods.hasPermission = async function(permissionKey) {
  const allPerms = await this.getAllPermissions();
  return allPerms.includes(permissionKey);
};

roleSchema.methods.addPermission = async function(permissionKey) {
  const Permission = mongoose.model('Permission');
  const perm = await Permission.findOne({ key: permissionKey });
  if (!perm) throw new Error(`Permission ${permissionKey} not found`);
  
  if (!this.permissions.includes(perm._id)) {
    this.permissions.push(perm._id);
    await this.save();
  }
  return this;
};

roleSchema.methods.removePermission = async function(permissionKey) {
  const Permission = mongoose.model('Permission');
  const perm = await Permission.findOne({ key: permissionKey });
  if (!perm) return this;
  
  this.permissions = this.permissions.filter(
    p => p.toString() !== perm._id.toString()
  );
  return this.save();
};

// Static methods
roleSchema.statics.getSystemRoles = async function() {
  return this.find({ type: 'system', isActive: true }).populate('permissions');
};

roleSchema.statics.seedSystemRoles = async function() {
  const Permission = mongoose.model('Permission');
  
  const roles = [
    {
      name: 'System Admin',
      slug: 'system_admin',
      type: 'system',
      level: 0,
      permissions: ['system:admin', 'role:manage', 'permission:assign']
    },
    {
      name: 'Tenant Admin',
      slug: 'tenant_admin',
      type: 'system',
      level: 10,
      permissions: [
        'vehicle:read_all', 'service_record:read_all', 'staff_profile:manage',
        'service_center:manage', 'report:read_all', 'billing:manage',
        'role:manage'
      ]
    },
    {
      name: 'Service Center Manager',
      slug: 'center_manager',
      type: 'system',
      level: 20,
      permissions: [
        'vehicle:read_all', 'service_record:create', 'service_record:read_all',
        'service_record:update', 'staff_profile:create', 'staff_profile:read',
        'staff_profile:update', 'service_center:update', 'reminder:manage',
        'report:read', 'billing:read'
      ]
    },
    {
      name: 'Technician',
      slug: 'technician',
      type: 'system',
      level: 30,
      permissions: [
        'vehicle:read_all', 'service_record:create', 'service_record:read_all',
        'service_record:update', 'reminder:read'
      ]
    },
    {
      name: 'Receptionist',
      slug: 'receptionist',
      type: 'system',
      level: 40,
      permissions: [
        'vehicle:read_all', 'service_record:create', 'service_record:read_all',
        'reminder:create', 'reminder:read'
      ]
    },
    {
      name: 'Accountant',
      slug: 'accountant',
      type: 'system',
      level: 50,
      permissions: [
        'service_record:read_all', 'billing:manage', 'report:read'
      ]
    },
    {
      name: 'Vehicle Owner',
      slug: 'vehicle_owner',
      type: 'system',
      level: 100,
      permissions: [
        'vehicle:create', 'vehicle:read', 'vehicle:update', 'vehicle:delete',
        'service_record:read', 'reminder:create', 'reminder:read',
        'owner_profile:update', 'invitation:create'
      ],
      isDefault: true
    }
  ];
  
  for (const roleData of roles) {
    const permissionKeys = roleData.permissions;
    const permissions = await Permission.find({ key: { $in: permissionKeys } });
    
    await this.findOneAndUpdate(
      { slug: roleData.slug, type: 'system' },
      {
        ...roleData,
        permissions: permissions.map(p => p._id)
      },
      { upsert: true, new: true }
    );
  }
};

roleSchema.statics.findForServiceCenter = function(centerId) {
  return this.find({
    $or: [
      { type: 'system' },
      { serviceCenterId: centerId }
    ],
    isActive: true
  }).populate('permissions');
};

export const Role = mongoose.model('Role', roleSchema);