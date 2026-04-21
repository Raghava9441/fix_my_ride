import { ServiceRecord } from "../models/ServiceRecord";
import { Vehicle } from "../models/Vehicle";
import { OwnerProfile } from "../models/OwnerProfile";
import { ServiceCenter } from "../models/ServiceCenter";
import { StaffProfile } from "../models/StaffProfile";
import mongoose from "mongoose";

export interface CreateServiceRecordInput {
  tenantId?: string;
  vehicleId: string;
  serviceCenterId: string;
  technicianId?: string;
  serviceDate?: Date;
  serviceType:
    | "oil_change"
    | "brake_service"
    | "tire_rotation"
    | "repair"
    | "maintenance"
    | "inspection"
    | "other";
  odometerReading: {
    value: number;
    unit?: "km" | "miles";
  };
  description: string;
  cost?: {
    partsTotal?: number;
    laborTotal?: number;
    discount?: number;
    currency?: string;
  };
  partsReplaced?: Array<{
    partName: string;
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
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdBy: {
    accountId: string;
    role: "owner" | "staff";
  };
}

export interface UpdateServiceRecordInput {
  serviceDate?: Date;
  serviceType?:
    | "oil_change"
    | "brake_service"
    | "tire_rotation"
    | "repair"
    | "maintenance"
    | "inspection"
    | "other";
  odometerReading?: {
    value: number;
    unit?: "km" | "miles";
  };
  description?: string;
  cost?: {
    partsTotal?: number;
    laborTotal?: number;
    tax?: number;
    discount?: number;
    paymentStatus?: "pending" | "paid" | "partial" | "waived";
    invoiceNumber?: string;
  };
  partsReplaced?: Array<{
    partName: string;
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
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
}

export interface ServiceRecordFilters {
  page?: number;
  limit?: number;
  tenantId?: string;
  vehicleId?: string;
  serviceCenterId?: string;
  ownerId?: string;
  technicianId?: string;
  serviceType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
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

export class ServiceRecordService {
  async findAll(filters?: ServiceRecordFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.vehicleId) query.vehicleId = filters.vehicleId;
    if (filters?.serviceCenterId)
      query.serviceCenterId = filters.serviceCenterId;
    if (filters?.ownerId) query.ownerId = filters.ownerId;
    if (filters?.technicianId) query.technicianId = filters.technicianId;
    if (filters?.serviceType) query.serviceType = filters.serviceType;
    if (filters?.status) query.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      query.serviceDate = {};
      if (filters?.startDate) query.serviceDate.$gte = filters.startDate;
      if (filters?.endDate) query.serviceDate.$lte = filters.endDate;
    }

    const [records, total] = await Promise.all([
      ServiceRecord.find(query)
        .populate("vehicleId", "registrationNumber make model year")
        .populate("serviceCenterId", "name")
        .populate("technicianId", "accountId")
        .populate("ownerId", "firstName lastName")
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

  async findById(id: string): Promise<any | null> {
    return ServiceRecord.findById(id)
      .populate("vehicleId", "registrationNumber make model year vin color")
      .populate("serviceCenterId", "name email phone address")
      .populate("technicianId", "accountId")
      .populate("ownerId", "firstName lastName email phone");
  }

  async findByVehicle(vehicleId: string): Promise<any[]> {
    return ServiceRecord.find({ vehicleId, isDeleted: false })
      .populate("serviceCenterId", "name")
      .populate("technicianId", "accountId")
      .sort({ serviceDate: -1 });
  }

  async findByOwner(ownerId: string): Promise<any[]> {
    return ServiceRecord.find({ ownerId, isDeleted: false })
      .populate("vehicleId", "registrationNumber make model")
      .populate("serviceCenterId", "name")
      .sort({ serviceDate: -1 });
  }

  async findByServiceCenter(serviceCenterId: string): Promise<any[]> {
    return ServiceRecord.find({ serviceCenterId, isDeleted: false })
      .populate("vehicleId", "registrationNumber make model")
      .populate("ownerId", "firstName lastName")
      .sort({ serviceDate: -1 });
  }

  async create(input: CreateServiceRecordInput): Promise<any> {
    const vehicle = await Vehicle.findById(input.vehicleId);
    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    const serviceCenter = await ServiceCenter.findById(input.serviceCenterId);
    if (!serviceCenter) {
      throw new Error("Service center not found");
    }

    const owner = await OwnerProfile.findById(vehicle.currentOwnerId);
    if (!owner) {
      throw new Error("Owner not found");
    }

    const cost = input.cost || {};
    const partsTotal = cost.partsTotal || 0;
    const laborTotal = cost.laborTotal || 0;
    const discount = cost.discount || 0;
    const subtotal = partsTotal + laborTotal;
    const tax = (subtotal - discount) * 0.1;
    const total = subtotal - discount + tax;

    const record = await ServiceRecord.create({
      tenantId: input.tenantId
        ? new mongoose.Types.ObjectId(input.tenantId)
        : undefined,
      vehicleId: new mongoose.Types.ObjectId(input.vehicleId),
      serviceCenterId: new mongoose.Types.ObjectId(input.serviceCenterId),
      technicianId: input.technicianId
        ? new mongoose.Types.ObjectId(input.technicianId)
        : undefined,
      ownerId: owner._id,
      serviceDate: input.serviceDate || new Date(),
      serviceType: input.serviceType,
      odometerReading: {
        value: input.odometerReading.value,
        unit: input.odometerReading.unit || "km",
      },
      description: input.description,
      cost: {
        partsTotal,
        laborTotal,
        subtotal,
        tax,
        discount,
        total,
        currency: cost.currency || "USD",
        paymentStatus: "pending",
      },
      partsReplaced: input.partsReplaced || [],
      nextService: input.nextService || {
        recommendedDate: undefined,
        recommendedOdometer: undefined,
        serviceType: undefined,
      },
      status: input.status || "scheduled",
      createdBy: {
        accountId: new mongoose.Types.ObjectId(input.createdBy.accountId),
        role: input.createdBy.role,
      },
      isDeleted: false,
    });

    if (input.status === "completed" && input.nextService) {
      vehicle.serviceSchedule = {
        lastServiceDate: input.serviceDate || new Date(),
        lastServiceOdometer: input.odometerReading.value,
        nextServiceDueDate: input.nextService.recommendedDate,
        nextServiceDueOdometer: input.nextService.recommendedOdometer,
      };
      vehicle.currentOdometer = {
        value: input.odometerReading.value,
        unit: input.odometerReading.unit || "km",
        recordedAt: new Date(),
      };
      await vehicle.save();
    }

    return record;
  }

  async update(
    id: string,
    updates: UpdateServiceRecordInput,
  ): Promise<any | null> {
    const updateObj: any = { ...updates };

    if (updates.cost) {
      const existing = await ServiceRecord.findById(id);
      const partsTotal =
        updates.cost.partsTotal ?? existing?.cost.partsTotal ?? 0;
      const laborTotal =
        updates.cost.laborTotal ?? existing?.cost.laborTotal ?? 0;
      const discount = updates.cost.discount ?? existing?.cost.discount ?? 0;
      const tax = updates.cost.tax ?? existing?.cost.tax ?? 0;
      const subtotal = partsTotal + laborTotal;
      const total = subtotal - discount + tax;

      updateObj.cost = {
        partsTotal,
        laborTotal,
        subtotal,
        tax,
        discount,
        total,
        currency: updates.cost.currency ?? existing?.cost.currency ?? "USD",
        paymentStatus:
          updates.cost.paymentStatus ??
          existing?.cost.paymentStatus ??
          "pending",
        invoiceNumber:
          updates.cost.invoiceNumber ?? existing?.cost.invoiceNumber,
      };
    }

    const record = await ServiceRecord.findByIdAndUpdate(id, updateObj, {
      new: true,
      runValidators: true,
    })
      .populate("vehicleId", "registrationNumber make model")
      .populate("serviceCenterId", "name");

    return record;
  }

  async delete(id: string): Promise<any | null> {
    const record = await ServiceRecord.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    return record;
  }

  async updateStatus(
    id: string,
    status: "scheduled" | "in_progress" | "completed" | "cancelled",
  ): Promise<any> {
    const record = await ServiceRecord.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { status } },
      { new: true },
    )
      .populate("vehicleId")
      .populate("serviceCenterId", "name");

    if (!record) {
      throw new Error("Service record not found");
    }

    if (status === "completed") {
      const vehicle = await Vehicle.findById(record.vehicleId);
      if (vehicle) {
        vehicle.currentOdometer = {
          value: record.odometerReading.value,
          unit: record.odometerReading.unit,
          recordedAt: record.serviceDate,
        };
        if (record.nextService) {
          vehicle.serviceSchedule = {
            lastServiceDate: record.serviceDate,
            lastServiceOdometer: record.odometerReading.value,
            nextServiceDueDate: record.nextService.recommendedDate,
            nextServiceDueOdometer: record.nextService.recommendedOdometer,
          };
        }
        await vehicle.save();
      }

      if (record.technicianId) {
        const staff = await StaffProfile.findById(record.technicianId);
        if (staff) {
          staff.stats.totalServicesPerformed += 1;
          staff.stats.totalRevenueGenerated += record.cost.total;
          await staff.save();
        }
      }

      const serviceCenter = await ServiceCenter.findById(
        record.serviceCenterId,
      );
      if (serviceCenter) {
        serviceCenter.stats.totalServiceRecords += 1;
        serviceCenter.stats.totalRevenue += record.cost.total;
        await serviceCenter.save();
      }
    }

    return record;
  }

  async getRevenueReport(
    serviceCenterId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const result = await ServiceRecord.aggregate([
      {
        $match: {
          serviceCenterId: new mongoose.Types.ObjectId(serviceCenterId),
          status: "completed",
          serviceDate: { $gte: startDate, $lte: endDate },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$serviceDate" } },
          totalRevenue: { $sum: "$cost.total" },
          totalServices: { $sum: 1 },
          partsTotal: { $sum: "$cost.partsTotal" },
          laborTotal: { $sum: "$cost.laborTotal" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result;
  }

  async getServiceTypeBreakdown(
    serviceCenterId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const match: any = {
      serviceCenterId: new mongoose.Types.ObjectId(serviceCenterId),
      status: "completed",
      isDeleted: false,
    };

    if (startDate || endDate) {
      match.serviceDate = {};
      if (startDate) match.serviceDate.$gte = startDate;
      if (endDate) match.serviceDate.$lte = endDate;
    }

    const result = await ServiceRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$serviceType",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$cost.total" },
          averageCost: { $avg: "$cost.total" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return result;
  }

  async getCustomerHistory(
    ownerId: string,
    options?: { limit?: number },
  ): Promise<any[]> {
    return ServiceRecord.find({ ownerId, isDeleted: false })
      .populate("vehicleId", "registrationNumber make model")
      .populate("serviceCenterId", "name")
      .sort({ serviceDate: -1 })
      .limit(options?.limit || 50);
  }
}

export const serviceRecordService = new ServiceRecordService();
