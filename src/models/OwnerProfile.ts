// models/OwnerProfile.js

import mongoose, { Schema } from "mongoose";

const ownerProfileSchema = new Schema({
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    unique: true,
    index: true
  },
  
  // Profile Info
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, maxlength: 50 },
  profileImage: String,
  alternateEmail: String,
  alternatePhone: String,
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    coordinates: { type: [Number], index: '2dsphere' }
  },
  
  // Vehicles (references only)
  vehicles: [{
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    addedAt: { type: Date, default: Date.now },
    isPrimary: { type: Boolean, default: false }
  }],
  
  // Preferences
  defaultVehicleId: Schema.Types.ObjectId,
  preferredServiceCenterId: { type: Schema.Types.ObjectId, ref: 'ServiceCenter' },
  
  notificationPreferences: {
    serviceReminders: { email: Boolean, sms: Boolean, push: Boolean },
    invoiceNotifications: { email: Boolean, sms: Boolean },
    centerCommunications: { email: Boolean, sms: Boolean },
    quietHours: { enabled: Boolean, start: String, end: String }
  },
  
  stats: {
    totalVehicles: { type: Number, default: 0 },
    totalServices: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    memberSince: { type: Date, default: Date.now }
  },

  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

// Virtuals
ownerProfileSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Permission checking for owners (simplified - owners have implicit permissions on their data)
ownerProfileSchema.methods.can = function(permissionKey, resourceId = null) {
  const [resource, action] = permissionKey.split(':');
  
  // Owners have full control over their own data
  const ownerResources = ['vehicle', 'service_record', 'reminder', 'owner_profile', 'invitation'];
  
  if (!ownerResources.includes(resource)) return false;
  
  // Read own data
  if (action === 'read' || action === 'create') return true;
  
  // For update/delete, check ownership if resourceId provided
  if (resourceId && ['update', 'delete'].includes(action)) {
    return this.ownsResource(resource, resourceId);
  }
  
  return true;
};

ownerProfileSchema.methods.ownsResource = async function(resource, resourceId) {
  switch (resource) {
    case 'vehicle':
      return this.vehicles.some(v => v.vehicleId.toString() === resourceId.toString());
      
    case 'service_record':
      const ServiceRecord = mongoose.model('ServiceRecord');
      const record = await ServiceRecord.findById(resourceId);
      return record && record.ownerId.toString() === this._id.toString();
      
    case 'reminder':
      const Reminder = mongoose.model('Reminder');
      const reminder = await Reminder.findById(resourceId);
      return reminder && reminder.ownerId.toString() === this._id.toString();
      
    default:
      return true;
  }
};

// Get all permissions (for UI)
ownerProfileSchema.methods.getPermissions = function() {
  return [
    'vehicle:create', 'vehicle:read', 'vehicle:update', 'vehicle:delete',
    'service_record:read',
    'reminder:create', 'reminder:read',
    'owner_profile:update',
    'invitation:create', 'invitation:read'
  ];
};

export const OwnerProfile = mongoose.model('OwnerProfile', ownerProfileSchema);