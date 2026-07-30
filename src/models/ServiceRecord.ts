// models/ServiceRecord.js
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { tenantPlugin } from '../middleware/tenant/tenantPlugin';

export interface IServiceRecord extends Document {
  tenantId?: Types.ObjectId;
  vehicleId: Types.ObjectId;
  serviceCenterId: Types.ObjectId;
  technicianId?: Types.ObjectId;
  ownerId: Types.ObjectId;
  serviceDate: Date;
  serviceType: 'oil_change' | 'brake_service' | 'tire_rotation' | 'repair' | 'maintenance' | 'inspection' | 'other';
  odometerReading: {
    value: number;
    unit?: 'km' | 'miles';
  };
  description: string;
  cost: {
    partsTotal: number;
    laborTotal: number;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    currency: string;
    paymentStatus: 'pending' | 'paid' | 'partial' | 'waived';
    invoiceNumber?: string;
  };
  partsReplaced: Types.DocumentArray<{
    partName?: string;
    partNumber?: string;
    quantity?: number;
    unitCost?: number;
    totalCost?: number;
    warrantyMonths?: number;
  }>;
  nextService?: {
    recommendedDate?: Date;
    recommendedOdometer?: number;
    serviceType?: string;
  };
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: {
    accountId: Types.ObjectId;
    role: 'owner' | 'staff';
  };
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IServiceRecordModel extends Model<IServiceRecord> {}

const serviceRecordSchema = new Schema<IServiceRecord, IServiceRecordModel>({
  tenantId: Schema.Types.ObjectId,

  // References
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },

  // Who performed the service (StaffProfile)
  serviceCenterId: { type: Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
  technicianId: { type: Schema.Types.ObjectId, ref: 'StaffProfile' },

  // Who owns the vehicle (OwnerProfile)
  ownerId: { type: Schema.Types.ObjectId, ref: 'OwnerProfile', required: true },

  // Service Details
  serviceDate: { type: Date, required: true, default: Date.now },
  serviceType: {
    type: String,
    required: true,
    enum: ['oil_change', 'brake_service', 'tire_rotation', 'repair', 'maintenance', 'inspection', 'other']
  },

  odometerReading: {
    value: { type: Number, required: true },
    unit: { type: String, enum: ['km', 'miles'] }
  },

  description: { type: String, required: true },

  // Financials
  cost: {
    partsTotal: { type: Number, default: 0 },
    laborTotal: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'waived'],
      default: 'pending'
    },
    invoiceNumber: String
  },

  // Parts (embedded snapshot)
  partsReplaced: [{
    partName: String,
    partNumber: String,
    quantity: Number,
    unitCost: Number,
    totalCost: Number,
    warrantyMonths: Number
  }],

  // Next Service
  nextService: {
    recommendedDate: Date,
    recommendedOdometer: Number,
    serviceType: String
  },

  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },

  // Created by (Account ID - could be owner or staff)
  createdBy: {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    role: { type: String, enum: ['owner', 'staff'], required: true }
  },

  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

serviceRecordSchema.index({ vehicleId: 1, serviceDate: -1 });
serviceRecordSchema.index({ serviceCenterId: 1, serviceDate: -1 });
serviceRecordSchema.index({ ownerId: 1, serviceDate: -1 });

serviceRecordSchema.plugin(tenantPlugin);

export const ServiceRecord = mongoose.model<IServiceRecord, IServiceRecordModel>('ServiceRecord', serviceRecordSchema);
