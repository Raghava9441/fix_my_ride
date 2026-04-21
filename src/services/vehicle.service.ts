import { Vehicle } from "../models/Vehicle";
import { OwnerProfile } from "../models/OwnerProfile";
import { ServiceCenter } from "../models/ServiceCenter";
import { ServiceRecord } from "../models/ServiceRecord";
import { OdometerReading } from "../models/OdometerReading";
import mongoose from "mongoose";

export interface CreateVehicleInput {
  tenantId?: string;
  registrationNumber: string;
  vin?: string;
  make: string;
  model: string;
  year: number;
  fuelType: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | "lpg";
  transmission?: "manual" | "automatic" | "cvt";
  color?: string;
  currentOwnerId: string;
  currentOdometer: {
    value: number;
    unit?: "km" | "miles";
  };
  serviceSchedule?: {
    lastServiceDate?: Date;
    lastServiceOdometer?: number;
    nextServiceDueDate?: Date;
    nextServiceDueOdometer?: number;
  };
}

export interface UpdateVehicleInput {
  registrationNumber?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | "lpg";
  transmission?: "manual" | "automatic" | "cvt";
  color?: string;
  currentOdometer?: {
    value: number;
    unit?: "km" | "miles";
    recordedAt?: Date;
  };
  serviceSchedule?: {
    lastServiceDate?: Date;
    lastServiceOdometer?: number;
    nextServiceDueDate?: Date;
    nextServiceDueOdometer?: number;
  };
}

export interface VehicleFilters {
  page?: number;
  limit?: number;
  tenantId?: string;
  currentOwnerId?: string;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class VehicleService {
  async findAll(filters?: VehicleFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.currentOwnerId) query.currentOwnerId = filters.currentOwnerId;
    if (filters?.make) query.make = filters.make;
    if (filters?.model) query.model = filters.model;
    if (filters?.year) query.year = filters.year;
    if (filters?.fuelType) query.fuelType = filters.fuelType;

    const [vehicles, total] = await Promise.all([
      Vehicle.find(query)
        .populate("currentOwnerId", "firstName lastName")
        .populate("authorizedServiceCenters.serviceCenterId", "name email")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Vehicle.countDocuments(query),
    ]);

    return {
      data: vehicles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Vehicle.findById(id)
      .populate("currentOwnerId", "firstName lastName email phone")
      .populate(
        "authorizedServiceCenters.serviceCenterId",
        "name email phone address",
      );
  }

  async findByRegistration(
    registrationNumber: string,
    tenantId?: string,
  ): Promise<any | null> {
    const query: any = {
      registrationNumber: registrationNumber.toUpperCase(),
      isDeleted: false,
    };
    if (tenantId) {
      query.tenantId = tenantId;
    }

    return Vehicle.findOne(query)
      .populate("currentOwnerId", "firstName lastName")
      .populate("authorizedServiceCenters.serviceCenterId", "name");
  }

  async findByVin(vin: string): Promise<any | null> {
    return Vehicle.findOne({
      vin: vin.toUpperCase(),
      isDeleted: false,
    }).populate("currentOwnerId", "firstName lastName");
  }

  async findByOwner(ownerId: string): Promise<any[]> {
    return Vehicle.find({ currentOwnerId: ownerId, isDeleted: false }).populate(
      "authorizedServiceCenters.serviceCenterId",
      "name",
    );
  }

  async findByServiceCenter(serviceCenterId: string): Promise<any[]> {
    return Vehicle.find({
      "authorizedServiceCenters.serviceCenterId": serviceCenterId,
      "authorizedServiceCenters.status": "active",
      isDeleted: false,
    })
      .populate("currentOwnerId", "firstName lastName")
      .sort({ "authorizedServiceCenters.authorizedAt": -1 });
  }

  async create(input: CreateVehicleInput): Promise<any> {
    const existing = await Vehicle.findOne({
      registrationNumber: input.registrationNumber.toUpperCase(),
      isDeleted: false,
    });

    if (existing) {
      throw new Error("Vehicle with this registration number already exists");
    }

    const owner = await OwnerProfile.findById(input.currentOwnerId);
    if (!owner) {
      throw new Error("Owner profile not found");
    }

    const vehicle = await Vehicle.create({
      tenantId: input.tenantId
        ? new mongoose.Types.ObjectId(input.tenantId)
        : undefined,
      registrationNumber: input.registrationNumber.toUpperCase(),
      vin: input.vin?.toUpperCase(),
      make: input.make,
      model: input.model,
      year: input.year,
      fuelType: input.fuelType,
      transmission: input.transmission || "manual",
      color: input.color,
      currentOwnerId: new mongoose.Types.ObjectId(input.currentOwnerId),
      ownershipHistory: [
        {
          ownerId: new mongoose.Types.ObjectId(input.currentOwnerId),
          fromDate: new Date(),
        },
      ],
      authorizedServiceCenters: [],
      currentOdometer: {
        value: input.currentOdometer.value,
        unit: input.currentOdometer.unit || "km",
        recordedAt: new Date(),
      },
      serviceSchedule: input.serviceSchedule || {
        lastServiceDate: undefined,
        lastServiceOdometer: undefined,
        nextServiceDueDate: undefined,
        nextServiceDueOdometer: undefined,
      },
      isDeleted: false,
    });

    return vehicle;
  }

  async update(id: string, updates: UpdateVehicleInput): Promise<any | null> {
    const updateObj: any = { ...updates };

    if (updates.registrationNumber) {
      updateObj.registrationNumber = updates.registrationNumber.toUpperCase();
    }

    if (updates.vin) {
      updateObj.vin = updates.vin.toUpperCase();
    }

    if (updates.currentOdometer) {
      updateObj.currentOdometer = {
        ...updates.currentOdometer,
        recordedAt: updates.currentOdometer.recordedAt || new Date(),
      };
    }

    const vehicle = await Vehicle.findByIdAndUpdate(id, updateObj, {
      new: true,
      runValidators: true,
    })
      .populate("currentOwnerId", "firstName lastName")
      .populate("authorizedServiceCenters.serviceCenterId", "name");

    return vehicle;
  }

  async delete(id: string): Promise<any | null> {
    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    return vehicle;
  }

  async authorizeServiceCenter(
    vehicleId: string,
    serviceCenterId: string,
    authorizedBy: string,
    accessLevel: "full" | "readonly" | "limited" = "full",
    isPrimary: boolean = false,
  ): Promise<any> {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    const serviceCenter = await ServiceCenter.findById(serviceCenterId);
    if (!serviceCenter) {
      throw new Error("Service center not found");
    }

    const existing = vehicle.authorizedServiceCenters.find(
      (asc) => asc.serviceCenterId.toString() === serviceCenterId,
    );

    if (existing) {
      existing.status = "active";
      existing.accessLevel = accessLevel;
      existing.authorizedAt = new Date();
      existing.authorizedBy = new mongoose.Types.ObjectId(authorizedBy);
    } else {
      vehicle.authorizedServiceCenters.push({
        serviceCenterId: new mongoose.Types.ObjectId(serviceCenterId),
        authorizedBy: new mongoose.Types.ObjectId(authorizedBy),
        authorizedAt: new Date(),
        accessLevel,
        status: "active",
        isPrimary,
      });
    }

    if (isPrimary) {
      vehicle.authorizedServiceCenters.forEach((asc) => {
        if (asc.serviceCenterId.toString() !== serviceCenterId) {
          asc.isPrimary = false;
        }
      });
    }

    await vehicle.save();
    return vehicle;
  }

  async revokeServiceCenter(
    vehicleId: string,
    serviceCenterId: string,
  ): Promise<any> {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    const center = vehicle.authorizedServiceCenters.find(
      (asc) => asc.serviceCenterId.toString() === serviceCenterId,
    );

    if (!center) {
      throw new Error("Service center not authorized");
    }

    center.status = "revoked";
    center.revokedAt = new Date();

    await vehicle.save();
    return vehicle;
  }

  async getServiceHistory(
    vehicleId: string,
    filters?: { page?: number; limit?: number; serviceCenterId?: string },
  ): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { vehicleId: vehicleId, isDeleted: false };
    if (filters?.serviceCenterId) {
      query.serviceCenterId = filters.serviceCenterId;
    }

    const [records, total] = await Promise.all([
      ServiceRecord.find(query)
        .populate("serviceCenterId", "name")
        .populate("technicianId", "accountId")
        .skip(skip)
        .limit(limit)
        .sort({ serviceDate: -1 }),
      ServiceRecord.countDocuments(query),
    ]);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateOdometer(
    vehicleId: string,
    value: number,
    unit: "km" | "miles" = "km",
    recordedBy?: string,
    source:
      | "manual_entry"
      | "service_record"
      | "import"
      | "api" = "manual_entry",
  ): Promise<any> {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    if (value < vehicle.currentOdometer.value) {
      throw new Error(
        "New odometer reading cannot be less than current reading",
      );
    }

    const oldValue = vehicle.currentOdometer.value;
    vehicle.currentOdometer = {
      value,
      unit,
      recordedAt: new Date(),
      recordedBy: recordedBy
        ? new mongoose.Types.ObjectId(recordedBy)
        : undefined,
    };

    await vehicle.save();

    await OdometerReading.create({
      vehicleId: vehicle._id,
      value,
      unit,
      recordedAt: new Date(),
      recordedBy: recordedBy
        ? new mongoose.Types.ObjectId(recordedBy)
        : undefined,
      recordedByModel: recordedBy ? "Account" : undefined,
      source,
      isVerified: false,
    });

    return vehicle;
  }

  async getOdometerHistory(
    vehicleId: string,
    options?: { limit?: number; from?: Date; to?: Date },
  ): Promise<any[]> {
    return OdometerReading.getHistory(vehicleId, options);
  }

  async transferOwnership(
    vehicleId: string,
    newOwnerId: string,
    transferReason?: string,
  ): Promise<any> {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    const newOwner = await OwnerProfile.findById(newOwnerId);
    if (!newOwner) {
      throw new Error("New owner not found");
    }

    const currentOwnerIndex = vehicle.ownershipHistory.findIndex(
      (h) => !h.toDate,
    );

    if (currentOwnerIndex >= 0) {
      vehicle.ownershipHistory[currentOwnerIndex].toDate = new Date();
    }

    vehicle.ownershipHistory.push({
      ownerId: new mongoose.Types.ObjectId(newOwnerId),
      fromDate: new Date(),
      transferReason,
    });

    vehicle.currentOwnerId = new mongoose.Types.ObjectId(newOwnerId);
    vehicle.currentOdometer = {
      ...vehicle.currentOdometer,
    };

    await vehicle.save();

    await newOwner.addVehicle(vehicleId, vehicleId, false);

    return vehicle;
  }
}

export const vehicleService = new VehicleService();
