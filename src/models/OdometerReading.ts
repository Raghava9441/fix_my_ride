// models/OdometerReading.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IOdometerReading extends Document {
  tenantId?: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  value: number;
  unit: 'km' | 'miles';
  recordedAt: Date;
  recordedBy?: mongoose.Types.ObjectId;
  recordedByModel?: 'Account' | 'OwnerProfile' | 'StaffProfile' | 'System';
  source: 'manual_entry' | 'service_record' | 'import' | 'api' | 'obd_device';
  isVerified: boolean;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  notes?: string;
  isDeleted: boolean;
}

const odometerReadingSchema = new Schema<IOdometerReading>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },
  
  vehicleId: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true,
    index: true
  },
  
  value: {
    type: Number,
    required: true,
    min: 0
  },
  
  unit: {
    type: String,
    enum: ['km', 'miles'],
    default: 'km'
  },
  
  recordedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  recordedBy: {
    type: Schema.Types.ObjectId,
    refPath: 'recordedByModel'
  },
  
  recordedByModel: {
    type: String,
    enum: ['Account', 'OwnerProfile', 'StaffProfile', 'System']
  },
  
  source: {
    type: String,
    enum: ['manual_entry', 'service_record', 'import', 'api', 'obd_device'],
    default: 'manual_entry'
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'StaffProfile'
  },
  
  verifiedAt: Date,
  
  notes: String,
  
  isDeleted: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Indexes
odometerReadingSchema.index({ vehicleId: 1, recordedAt: -1 });
odometerReadingSchema.index({ vehicleId: 1, value: -1 });

// Static methods
odometerReadingSchema.statics.getLatestForVehicle = function(vehicleId: string) {
  return this.findOne({ vehicleId, isDeleted: false })
    .sort({ recordedAt: -1 });
};

odometerReadingSchema.statics.getHistory = function(
  vehicleId: string,
  options: { limit?: number; from?: Date; to?: Date } = {}
) {
  const query: any = { vehicleId, isDeleted: false };
  
  if (options.from || options.to) {
    query.recordedAt = {};
    if (options.from) query.recordedAt.$gte = options.from;
    if (options.to) query.recordedAt.$lte = options.to;
  }
  
  return this.find(query)
    .sort({ recordedAt: -1 })
    .limit(options.limit || 100);
};

export const OdometerReading = mongoose.model<IOdometerReading>('OdometerReading', odometerReadingSchema);