// models/ServiceCenter.js

import mongoose, { Schema } from "mongoose";

const serviceCenterSchema = new Schema({
  // Multi-tenant
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },

  // Basic Info
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true
  },
  businessRegistrationNumber: {
    type: String,
    required: true,
    unique: true,
    sparse: true
  },
  
  // Contact
  email: { type: String, required: true, lowercase: true },
  phone: { type: String, required: true },
  website: String,
  
  // Address
  address: {
    street: String,
    city: { type: String, required: true, index: true },
    state: String,
    country: { type: String, default: 'US' },
    postalCode: String,
    coordinates: {
      type: { type: String, default: 'Point' },
      coordinates: { type: [Number], index: '2dsphere' }
    }
  },

  // Subscription (simplified)
  subscription: {
    planId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    status: {
      type: String,
      enum: ['trial', 'active', 'expired', 'suspended', 'cancelled'],
      default: 'trial'
    },
    startedAt: { type: Date, default: Date.now },
    expiresAt: Date,
    trialEndsAt: Date
  },

  // Settings
  settings: {
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'America/New_York' },
    businessHours: {
      monday: { open: String, close: String, closed: Boolean },
      tuesday: { open: String, close: String, closed: Boolean },
      wednesday: { open: String, close: String, closed: Boolean },
      thursday: { open: String, close: String, closed: Boolean },
      friday: { open: String, close: String, closed: Boolean },
      saturday: { open: String, close: String, closed: { type: Boolean, default: true } },
      sunday: { open: String, close: String, closed: { type: Boolean, default: true } }
    }
  },

  // Services Offered
  servicesOffered: [{
    name: String,
    category: String,
    duration: Number,
    basePrice: Number,
    isActive: { type: Boolean, default: true }
  }],

  // Stats
  stats: {
    totalVehiclesServed: { type: Number, default: 0 },
    activeVehicles: { type: Number, default: 0 },
    totalServiceRecords: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 }
  },

  // Created by which staff account
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'StaffProfile',
    required: true
  },

  isDeleted: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

// Indexes
serviceCenterSchema.index({ tenantId: 1, slug: 1 }, { unique: true, sparse: true });
serviceCenterSchema.index({ 'address.coordinates': '2dsphere' });
serviceCenterSchema.index({ 'subscription.status': 1 });

// Virtuals
serviceCenterSchema.virtual('staff', {
  ref: 'StaffProfile',
  localField: '_id',
  foreignField: 'serviceCenterId',
  match: { isDeleted: false, employmentStatus: 'active' }
});

serviceCenterSchema.virtual('vehicles', {
  ref: 'Vehicle',
  localField: '_id',
  foreignField: 'authorizedServiceCenters.serviceCenterId'
});

export const ServiceCenter = mongoose.model('ServiceCenter', serviceCenterSchema);
