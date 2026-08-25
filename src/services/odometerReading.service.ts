import mongoose from "mongoose";
import { OdometerReading } from "../models/OdometerReading";
import { Vehicle } from "../models/Vehicle";

export interface CreateOdometerReadingInput {
  tenantId?: string;
  vehicleId: string;
  value: number;
  unit?: "km" | "miles";
  recordedAt?: Date;
  recordedBy?: string;
  recordedByModel?: "Account" | "OwnerProfile" | "StaffProfile" | "System";
  source?: "manual_entry" | "service_record" | "import" | "api" | "obd_device";
  isVerified?: boolean;
  verifiedBy?: string;
  notes?: string;
}

export interface UpdateOdometerReadingInput {
  value?: number;
  unit?: "km" | "miles";
  isVerified?: boolean;
  verifiedBy?: string;
  notes?: string;
}

/**
 * The single place that writes an odometer reading — always keeps
 * Vehicle.currentOdometer (the fast-read cache) and the OdometerReading
 * history log in sync, so nothing (manual entry, service records, imports)
 * can update one without the other. Previously VehicleService.updateOdometer
 * did this only for manual entries, while serviceRecord.service.ts mutated
 * Vehicle.currentOdometer directly and never wrote a history row at all.
 */
export class OdometerReadingService {
  async getLatest(vehicleId: string) {
    return OdometerReading.getLatestForVehicle(vehicleId);
  }

  async getHistory(
    vehicleId: string,
    options?: { limit?: number; from?: Date; to?: Date },
  ) {
    return OdometerReading.getHistory(vehicleId, options);
  }

  async findById(id: string) {
    return OdometerReading.findOne({ _id: id, isDeleted: false });
  }

  async record(input: CreateOdometerReadingInput): Promise<any> {
    const vehicle = await Vehicle.findById(input.vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    const source = input.source ?? "manual_entry";
    const unit = input.unit ?? "km";
    const recordedAt = input.recordedAt ?? new Date();
    const recordedBy = input.recordedBy
      ? new mongoose.Types.ObjectId(input.recordedBy)
      : undefined;

    // service_record/import entries reconcile historical service visits and
    // may legitimately predate the vehicle's current cached reading — only
    // manual/API/OBD entry enforces the monotonic-increase rule.
    const enforceMonotonic = source === "manual_entry" || source === "api" || source === "obd_device";
    if (enforceMonotonic && input.value < vehicle.currentOdometer.value) {
      throw new Error("New odometer reading cannot be less than current reading");
    }

    if (!enforceMonotonic || input.value >= vehicle.currentOdometer.value) {
      vehicle.currentOdometer = { value: input.value, unit, recordedAt, recordedBy };
      await vehicle.save();
    }

    return OdometerReading.create({
      tenantId: input.tenantId
        ? new mongoose.Types.ObjectId(input.tenantId)
        : vehicle.tenantId,
      vehicleId: vehicle._id,
      value: input.value,
      unit,
      recordedAt,
      recordedBy,
      recordedByModel: input.recordedByModel ?? (recordedBy ? "Account" : undefined),
      source,
      isVerified: input.isVerified ?? false,
      verifiedBy: input.verifiedBy
        ? new mongoose.Types.ObjectId(input.verifiedBy)
        : undefined,
      notes: input.notes,
    });
  }

  /** Corrects a historical reading's own fields — does not touch Vehicle.currentOdometer. */
  async update(id: string, updates: UpdateOdometerReadingInput): Promise<any | null> {
    return OdometerReading.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updates },
      { new: true },
    );
  }

  async verify(id: string, verifiedBy: string): Promise<any | null> {
    return OdometerReading.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          isVerified: true,
          verifiedBy: new mongoose.Types.ObjectId(verifiedBy),
          verifiedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  async delete(id: string): Promise<any | null> {
    return OdometerReading.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true },
    );
  }
}

export const odometerReadingService = new OdometerReadingService();
