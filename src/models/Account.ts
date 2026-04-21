// models/Account.ts
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';    

export interface IAccount extends Document {
  email: string;
  phone?: string;
  passwordHash?: string;
  authProvider: 'email' | 'google' | 'facebook' | 'apple' | 'microsoft';
  authProviderId?: string;
  primaryRole: 'owner' | 'staff' | 'admin' | 'fleet_manager' | 'service_advisor';
  roles: string[];
  ownerProfileId?: mongoose.Types.ObjectId;
  staffProfileId?: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaBackupCodes: { code: string; used: boolean }[];
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  loginHistory: {
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    successful: boolean;
  }[];
  status: 'active' | 'suspended' | 'pending_verification' | 'deleted' | 'locked';
  suspensionReason?: string;
  lockedUntil?: Date;
  failedLoginAttempts: number;
  preferences: {
    language: string;
    timezone: string;
    currency: string;
    notificationPreferences: {
      email: { marketing: boolean; transactional: boolean; security: boolean };
      sms: { enabled: boolean; marketing: boolean };
      push: { enabled: boolean; deviceTokens: string[] };
    };
  };
  deletedAt?: Date;
  isDeleted: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
  hasRole(role: string): boolean;
  addRole(role: string, profileId?: mongoose.Types.ObjectId): Promise<IAccount>;
  recordLogin(ipAddress: string, userAgent: string, location: string, successful: boolean): Promise<IAccount>;
  generateEmailVerificationToken(): string;
  generatePasswordResetToken(): string;
  generateMfaSecret(): { secret: string; backupCodes: string[] };
  softDelete(): Promise<IAccount>;
}

const accountSchema = new Schema<IAccount>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  phone: {
    type: String,
    sparse: true,
    trim: true
  },
  
  passwordHash: {
    type: String,
    select: false
  },
  
  authProvider: {
    type: String,
    enum: ['email', 'google', 'facebook', 'apple', 'microsoft'],
    default: 'email'
  },
  authProviderId: { type: String, select: false },
  
  primaryRole: {
    type: String,
    enum: ['owner', 'staff', 'admin', 'fleet_manager', 'service_advisor'],
    required: true,
    default: 'owner'
  },
  
  roles: [{
    type: String,
    enum: ['owner', 'staff', 'admin', 'fleet_manager', 'service_advisor']
  }],
  
  ownerProfileId: {
    type: Schema.Types.ObjectId,
    ref: 'OwnerProfile'
  },
  staffProfileId: {
    type: Schema.Types.ObjectId,
    ref: 'StaffProfile'
  },
  
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mfaSecret: { type: String, select: false },
  mfaBackupCodes: [{
    code: { type: String, select: false },
    used: { type: Boolean, default: false }
  }],
  
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: Date,
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: Date,
  
  lastLoginAt: Date,
  lastActiveAt: Date,
  loginHistory: [{
    _id: false,
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    location: String,
    successful: { type: Boolean, required: true }
  }],
  
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending_verification', 'deleted', 'locked'],
    default: 'pending_verification'
  },
  suspensionReason: String,
  lockedUntil: Date,
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  
  preferences: {
    language: {
      type: String,
      enum: ['en', 'es', 'fr', 'de', 'ar', 'hi'],
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'INR', 'AED'],
      default: 'USD'
    },
    notificationPreferences: {
      email: {
        marketing: { type: Boolean, default: false },
        transactional: { type: Boolean, default: true },
        security: { type: Boolean, default: true }
      },
      sms: {
        enabled: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false }
      },
      push: {
        enabled: { type: Boolean, default: false },
        deviceTokens: [{ type: String, select: false }]
      }
    }
  },

  deletedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
accountSchema.index({ email: 1 }, { unique: true });
accountSchema.index({ phone: 1 }, { sparse: true });
accountSchema.index({ tenantId: 1, email: 1 }, { sparse: true });
accountSchema.index({ status: 1, lastLoginAt: -1 });
accountSchema.index({ isDeleted: 1, createdAt: -1 });
accountSchema.index({ authProviderId: 1, authProvider: 1 }, { sparse: true });

// Virtuals
accountSchema.virtual('ownerProfile', {
  ref: 'OwnerProfile',
  localField: 'ownerProfileId',
  foreignField: '_id',
  justOne: true
});

accountSchema.virtual('staffProfile', {
  ref: 'StaffProfile',
  localField: 'staffProfileId',
  foreignField: '_id',
  justOne: true
});

// Pre-save: Hash password
accountSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  if (this.passwordHash.startsWith('$2')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Methods
accountSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

accountSchema.methods.hasRole = function(role: string): boolean {
  return this.roles.includes(role) || this.primaryRole === role;
};

accountSchema.methods.addRole = async function(role: string, profileId?: mongoose.Types.ObjectId): Promise<IAccount> {
  if (!this.roles.includes(role)) {
    this.roles.push(role);
  }
  
  if (role === 'owner' && profileId) {
    this.ownerProfileId = profileId;
  } else if (role === 'staff' && profileId) {
    this.staffProfileId = profileId;
  }
  
  return this.save();
};

accountSchema.methods.recordLogin = function(
  ipAddress: string,
  userAgent: string,
  location: string,
  successful: boolean
): Promise<IAccount> {
  this.loginHistory.push({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    location,
    successful
  });
  
  if (this.loginHistory.length > 20) {
    this.loginHistory = this.loginHistory.slice(-20);
  }
  
  if (successful) {
    this.lastLoginAt = new Date();
    this.failedLoginAttempts = 0;
  } else {
    this.failedLoginAttempts += 1;
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
  }
  
  return this.save();
};

accountSchema.methods.generateEmailVerificationToken = function(): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return token;
};

accountSchema.methods.generatePasswordResetToken = function(): string {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  return token;
};

accountSchema.methods.generateMfaSecret = function(): { secret: string; backupCodes: string[] } {
  const secret = crypto.randomBytes(20).toString('hex');
  this.mfaSecret = secret;
  this.mfaBackupCodes = Array(10).fill(null).map(() => ({
    code: crypto.randomBytes(4).toString('hex').toUpperCase(),
    used: false
  }));
  return {
    secret,
    backupCodes: this.mfaBackupCodes.map((c: { code: string }) => c.code)
  };
};

accountSchema.methods.softDelete = async function(): Promise<IAccount> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status = 'deleted';
  this.email = `deleted_${this._id}_${this.email}`;
  return this.save();
};

// Static methods
accountSchema.statics.findByEmail = function(email: string, includeDeleted = false) {
  const query: any = { email: email.toLowerCase() };
  if (!includeDeleted) query.isDeleted = false;
  return this.findOne(query);
};

accountSchema.statics.findActive = function(filter = {}) {
  return this.find({
    ...filter,
    isDeleted: false,
    status: { $in: ['active', 'pending_verification'] },
    $or: [
      { lockedUntil: { $lte: new Date() } },
      { lockedUntil: null }
    ]
  });
};

export const Account = mongoose.model<IAccount>('Account', accountSchema);