// models/Vehicle.js
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IVehicle extends Omit<Document, 'model'> {
  tenantId?: Types.ObjectId;

  // Identifiers
  registrationNumber: string;
  vin?: string;

  // Vehicle Details
  make: string;
  model: string;
  year: number;
  fuelType: 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'cng' | 'lpg';
  transmission: 'manual' | 'automatic' | 'cvt';
  color?: string;

  // Ownership - references OwnerProfile
  currentOwnerId: Types.ObjectId;
  ownershipHistory: Types.DocumentArray<{
    ownerId?: Types.ObjectId;
    fromDate?: Date;
    toDate?: Date;
    transferReason?: string;
  }>;

  // Authorized Service Centers
  authorizedServiceCenters: Types.DocumentArray<{
    serviceCenterId: Types.ObjectId;
    authorizedBy?: Types.ObjectId;
    authorizedAt: Date;
    accessLevel: 'full' | 'readonly' | 'limited';
    status: 'active' | 'revoked' | 'expired';
    isPrimary: boolean;
    revokedAt?: Date;
  }>;

  // Odometer
  currentOdometer: {
    value: number;
    unit: 'km' | 'miles';
    recordedAt: Date;
    recordedBy?: Types.ObjectId;
  };

  // Service Schedule
  serviceSchedule?: {
    lastServiceDate?: Date;
    lastServiceOdometer?: number;
    nextServiceDueDate?: Date;
    nextServiceDueOdometer?: number;
  };

  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVehicleModel extends Model<IVehicle> {}

const vehicleSchema = new Schema<IVehicle, IVehicleModel>({
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
      validator: (v: string) => !v || /^[A-HJ-NPR-Z0-9]{17}$/i.test(v),
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
    serviceCenterId: { type: Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
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
    isPrimary: { type: Boolean, default: false },
    revokedAt: Date
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

  isDeleted: { type: Boolean, default: false },
  deletedAt: Date

}, { timestamps: true });

// Compound unique per tenant
vehicleSchema.index({ tenantId: 1, registrationNumber: 1 }, { unique: true, sparse: true });
vehicleSchema.index({ currentOwnerId: 1 });
vehicleSchema.index({ 'authorizedServiceCenters.serviceCenterId': 1 });

export const Vehicle = mongoose.model<IVehicle, IVehicleModel>('Vehicle', vehicleSchema);
