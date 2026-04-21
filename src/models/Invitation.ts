// models/Invitation.ts
import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IInvitation extends Document {
  tenantId?: mongoose.Types.ObjectId;
  
  // Inviter
  inviterId: mongoose.Types.ObjectId;
  inviterType: 'OwnerProfile' | 'StaffProfile' | 'Account' | 'ServiceCenter';
  inviterName?: string;
  
  // Invitee
  inviteeEmail?: string;
  inviteePhone?: string;
  inviteeName?: string;
  
  // Context
  invitationType: 'vehicle_access' | 'center_staff' | 'ownership_transfer' | 'collaborator';
  vehicleId?: mongoose.Types.ObjectId;
  serviceCenterId?: mongoose.Types.ObjectId;
  
  // Access Config
  role: 'owner' | 'technician' | 'manager' | 'receptionist' | 'accountant' | 'viewer' | 'admin';
  accessLevel: 'full' | 'readonly' | 'limited';
  permissions?: string[];
  
  // Token Security
  token: string;
  tokenHash?: string;
  
  // Usage Control
  maxUses: number;
  useCount: number;
  
  // Validity
  expiresAt: Date;
  
  // Status
  status: 'pending' | 'accepted' | 'expired' | 'revoked' | 'maxed_out';
  
  // Response
  acceptedAt?: Date;
  acceptedBy?: mongoose.Types.ObjectId;
  acceptedByType?: string;
  
  // Revocation
  revokedAt?: Date;
  revokedBy?: mongoose.Types.ObjectId;
  revokedReason?: string;
  
  // Tracking
  message?: string;
  sentAt?: Date;
  lastRemindedAt?: Date;
  reminderCount: number;
  
  // Audit
  createdBy: mongoose.Types.ObjectId;
  
  isDeleted: boolean;
  
  // Methods
  isValid(): boolean;
  accept(userId: mongoose.Types.ObjectId, userType: string): Promise<IInvitation>;
  grantAccess(userId: mongoose.Types.ObjectId): Promise<void>;
  revoke(revokedBy: mongoose.Types.ObjectId, reason?: string): Promise<IInvitation>;
  sendReminder(): Promise<boolean>;
}

const invitationSchema = new Schema<IInvitation>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  
  // Inviter
  inviterId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'inviterType'
  },
  inviterType: {
    type: String,
    required: true,
    enum: ['OwnerProfile', 'StaffProfile', 'Account', 'ServiceCenter']
  },
  inviterName: String,
  
  // Invitee
  inviteeEmail: {
    type: String,
    lowercase: true,
    trim: true,
    index: true
  },
  inviteePhone: String,
  inviteeName: String,
  
  // Context
  invitationType: {
    type: String,
    required: true,
    enum: ['vehicle_access', 'center_staff', 'ownership_transfer', 'collaborator']
  },
  vehicleId: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  serviceCenterId: {
    type: Schema.Types.ObjectId,
    ref: 'ServiceCenter'
  },
  
  // Access Config
  role: {
    type: String,
    required: true,
    enum: ['owner', 'technician', 'manager', 'receptionist', 'accountant', 'viewer', 'admin']
  },
  accessLevel: {
    type: String,
    enum: ['full', 'readonly', 'limited'],
    default: 'readonly'
  },
  permissions: [String],
  
  // Token Security
  token: {
    type: String,
    unique: true,
    default: () => crypto.randomBytes(32).toString('hex'),
    index: true
  },
  tokenHash: {
    type: String,
    select: false
  },
  
  // Usage Control
  maxUses: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  useCount: {
    type: Number,
    default: 0
  },
  
  // Validity
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked', 'maxed_out'],
    default: 'pending',
    index: true
  },
  
  // Response
  acceptedAt: Date,
  acceptedBy: {
    type: Schema.Types.ObjectId,
    refPath: 'acceptedByType'
  },
  acceptedByType: String,
  
  // Revocation
  revokedAt: Date,
  revokedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Account'
  },
  revokedReason: String,
  
  // Tracking
  message: String,
  sentAt: Date,
  lastRemindedAt: Date,
  reminderCount: {
    type: Number,
    default: 0,
    max: 3 // Max 3 reminders
  },
  
  // Audit
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true
  },
  
  isDeleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Indexes
invitationSchema.index({ token: 1 }, { unique: true });
invitationSchema.index({ inviteeEmail: 1, status: 1 });
invitationSchema.index({ vehicleId: 1, status: 1 });
invitationSchema.index({ serviceCenterId: 1, status: 1 });
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save: Auto-expire check
invitationSchema.pre('save', function(next) {
  // Auto-expire if past expiry
  if (this.expiresAt < new Date() && this.status === 'pending') {
    this.status = 'expired';
  }
  
  // Max uses check
  if (this.useCount >= this.maxUses && this.status === 'pending') {
    this.status = 'maxed_out';
  }
  
  next();
});

// Methods
invitationSchema.methods.isValid = function(): boolean {
  return this.status === 'pending' && 
         this.expiresAt > new Date() && 
         this.useCount < this.maxUses;
};

invitationSchema.methods.accept = async function(
  userId: mongoose.Types.ObjectId,
  userType: string
): Promise<IInvitation> {
  if (!this.isValid()) {
    throw new Error(this.status === 'expired' ? 'Invitation expired' : 'Invitation invalid');
  }
  
  this.useCount += 1;
  
  if (this.useCount >= this.maxUses) {
    this.status = 'accepted';
    this.acceptedAt = new Date();
    this.acceptedBy = userId;
    this.acceptedByType = userType;
    
    // Execute access grant based on type
    await this.grantAccess(userId);
  }
  
  return this.save();
};

invitationSchema.methods.grantAccess = async function(userId: mongoose.Types.ObjectId): Promise<void> {
  const Vehicle = mongoose.model('Vehicle');
  
  if (this.invitationType === 'vehicle_access' && this.vehicleId) {
    await Vehicle.findByIdAndUpdate(this.vehicleId, {
      $push: {
        authorizedServiceCenters: {
          serviceCenterId: this.serviceCenterId,
          authorizedBy: this.inviterId,
          accessLevel: this.accessLevel,
          status: 'active',
          authorizedAt: new Date()
        }
      }
    });
  }
  // Add other invitation types as needed
};

invitationSchema.methods.revoke = async function(
  revokedBy: mongoose.Types.ObjectId,
  reason?: string
): Promise<IInvitation> {
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revokedReason = reason;
  return this.save();
};

invitationSchema.methods.sendReminder = async function(): Promise<boolean> {
  if (this.reminderCount >= 3) return false;
  
  this.lastRemindedAt = new Date();
  this.reminderCount += 1;
  await this.save();
  
  // Trigger notification service here
  return true;
};

// Static methods
invitationSchema.statics.findValidByToken = function(token: string) {
  return this.findOne({
    token,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('vehicleId serviceCenterId inviterId');
};

invitationSchema.statics.findPendingByEmail = function(email: string) {
  return this.find({
    inviteeEmail: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('vehicleId serviceCenterId');
};

invitationSchema.statics.createVehicleAccess = async function(data: {
  tenantId?: mongoose.Types.ObjectId;
  inviterId: mongoose.Types.ObjectId;
  inviterName?: string;
  email?: string;
  phone?: string;
  name?: string;
  vehicleId: mongoose.Types.ObjectId;
  serviceCenterId: mongoose.Types.ObjectId;
  role?: string;
  accessLevel?: string;
  permissions?: string[];
  message?: string;
  maxUses?: number;
  expiresAt?: Date;
}): Promise<IInvitation> {
  return this.create({
    tenantId: data.tenantId,
    inviterId: data.inviterId,
    inviterType: 'OwnerProfile',
    inviterName: data.inviterName,
    inviteeEmail: data.email,
    inviteePhone: data.phone,
    inviteeName: data.name,
    invitationType: 'vehicle_access',
    vehicleId: data.vehicleId,
    serviceCenterId: data.serviceCenterId,
    role: data.role || 'technician',
    accessLevel: data.accessLevel || 'readonly',
    permissions: data.permissions,
    message: data.message,
    maxUses: data.maxUses || 1,
    expiresAt: data.expiresAt,
    createdBy: data.inviterId
  });
};

export const Invitation = mongoose.model<IInvitation>('Invitation', invitationSchema);