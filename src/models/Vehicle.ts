// models/Vehicle.js
import mongoose, { Schema } from "mongoose";

const vehicleSchema = new Schema({
  tenantId: Schema.Types.ObjectId,

  // Identifiers
  registrationNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  vin: {
    type: String,
    uppercase: true,
    sparse: true,
    validate: {
      validator: v => !v || /^[A-HJ-NPR-Z0-9]{17}$/i.test(v),
      message: 'Invalid VIN'
    }
  },

  // Vehicle Details
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg'],
    required: true
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic', 'cvt'],
    default: 'manual'
  },
  color: String,

  // Ownership - references OwnerProfile
  currentOwnerId: {
    type: Schema.Types.ObjectId,
    ref: 'OwnerProfile',
    required: true,
    index: true
  },
  ownershipHistory: [{
    ownerId: { type: Schema.Types.ObjectId, ref: 'OwnerProfile' },
    fromDate: Date,
    toDate: Date,
    transferReason: String
  }],

  // Authorized Service Centers
  authorizedServiceCenters: [{
    serviceCenterId: { type: Schema.Types.ObjectId, ref: 'ServiceCenter' },
    authorizedBy: { type: Schema.Types.ObjectId, ref: 'OwnerProfile' },
    authorizedAt: { type: Date, default: Date.now },
    accessLevel: {
      type: String,
      enum: ['full', 'readonly', 'limited'],
      default: 'full'
    },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active'
    },
    isPrimary: { type: Boolean, default: false }
  }],

  // Odometer
  currentOdometer: {
    value: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: ['km', 'miles'], default: 'km' },
    recordedAt: { type: Date, default: Date.now },
    recordedBy: Schema.Types.ObjectId // Account ID
  },

  // Service Schedule
  serviceSchedule: {
    lastServiceDate: Date,
    lastServiceOdometer: Number,
    nextServiceDueDate: Date,
    nextServiceDueOdometer: Number
  },

  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

// Compound unique per tenant
vehicleSchema.index({ tenantId: 1, registrationNumber: 1 }, { unique: true, sparse: true });
vehicleSchema.index({ currentOwnerId: 1 });
vehicleSchema.index({ 'authorizedServiceCenters.serviceCenterId': 1 });

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
