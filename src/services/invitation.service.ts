import { Invitation, IInvitation } from "../models/Invitation";
import { Vehicle } from "../models/Vehicle";
import { ServiceCenter } from "../models/ServiceCenter";
import mongoose from "mongoose";

export interface CreateInvitationInput {
  tenantId?: string;
  inviterId: string;
  inviterType: "OwnerProfile" | "StaffProfile" | "Account" | "ServiceCenter";
  inviterName?: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  inviteeName?: string;
  invitationType:
    | "vehicle_access"
    | "center_staff"
    | "ownership_transfer"
    | "collaborator";
  vehicleId?: string;
  serviceCenterId?: string;
  role?: string;
  accessLevel?: "full" | "readonly" | "limited";
  permissions?: string[];
  message?: string;
  maxUses?: number;
  expiresAt?: Date;
}

export interface InvitationFilters {
  page?: number;
  limit?: number;
  tenantId?: string;
  inviteeEmail?: string;
  vehicleId?: string;
  serviceCenterId?: string;
  status?: string;
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

export class InvitationService {
  async findAll(filters?: InvitationFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.inviteeEmail) query.inviteeEmail = filters.inviteeEmail;
    if (filters?.vehicleId) query.vehicleId = filters.vehicleId;
    if (filters?.serviceCenterId)
      query.serviceCenterId = filters.serviceCenterId;
    if (filters?.status) query.status = filters.status;

    const [invitations, total] = await Promise.all([
      Invitation.find(query)
        .populate("vehicleId", "registrationNumber make model")
        .populate("serviceCenterId", "name")
        .populate("inviterId", "firstName lastName")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Invitation.countDocuments(query),
    ]);

    return {
      data: invitations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Invitation.findById(id)
      .populate("vehicleId", "registrationNumber make model")
      .populate("serviceCenterId", "name")
      .populate("inviterId");
  }

  async findByToken(token: string): Promise<any | null> {
    return Invitation.findValidByToken(token);
  }

  async findByEmail(email: string): Promise<any[]> {
    return Invitation.findPendingByEmail(email);
  }

  async findByVehicle(vehicleId: string): Promise<any[]> {
    return Invitation.find({
      vehicleId,
      status: "pending",
      expiresAt: { $gt: new Date() },
      isDeleted: false,
    })
      .populate("inviterId", "firstName lastName")
      .sort({ createdAt: -1 });
  }

  async findByServiceCenter(serviceCenterId: string): Promise<any[]> {
    return Invitation.find({
      serviceCenterId,
      status: "pending",
      expiresAt: { $gt: new Date() },
      isDeleted: false,
    })
      .populate("inviterId", "firstName lastName")
      .sort({ createdAt: -1 });
  }

  async create(input: CreateInvitationInput): Promise<any> {
    if (input.invitationType === "vehicle_access" && input.vehicleId) {
      const vehicle = await Vehicle.findById(input.vehicleId);
      if (!vehicle) {
        throw new Error("Vehicle not found");
      }
    }

    if (input.invitationType === "center_staff" && input.serviceCenterId) {
      const center = await ServiceCenter.findById(input.serviceCenterId);
      if (!center) {
        throw new Error("Service center not found");
      }
    }

    const invitation = await Invitation.create({
      tenantId: input.tenantId
        ? new mongoose.Types.ObjectId(input.tenantId)
        : undefined,
      inviterId: new mongoose.Types.ObjectId(input.inviterId),
      inviterType: input.inviterType,
      inviterName: input.inviterName,
      inviteeEmail: input.inviteeEmail?.toLowerCase(),
      inviteePhone: input.inviteePhone,
      inviteeName: input.inviteeName,
      invitationType: input.invitationType,
      vehicleId: input.vehicleId
        ? new mongoose.Types.ObjectId(input.vehicleId)
        : undefined,
      serviceCenterId: input.serviceCenterId
        ? new mongoose.Types.ObjectId(input.serviceCenterId)
        : undefined,
      role: input.role || "technician",
      accessLevel: input.accessLevel || "readonly",
      permissions: input.permissions || [],
      maxUses: input.maxUses || 1,
      expiresAt:
        input.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "pending",
      message: input.message,
      createdBy: new mongoose.Types.ObjectId(input.inviterId),
      isDeleted: false,
    });

    return invitation;
  }

  async accept(id: string, userId: string, userType: string): Promise<any> {
    const invitation = await Invitation.findById(id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    await invitation.accept(new mongoose.Types.ObjectId(userId), userType);
    return invitation;
  }

  async revoke(id: string, revokedBy: string, reason?: string): Promise<any> {
    const invitation = await Invitation.findById(id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    return invitation.revoke(new mongoose.Types.ObjectId(revokedBy), reason);
  }

  async sendReminder(id: string): Promise<boolean> {
    const invitation = await Invitation.findById(id);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    return invitation.sendReminder();
  }

  async delete(id: string): Promise<any | null> {
    const invitation = await Invitation.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    return invitation;
  }

  async createVehicleAccess(input: {
    inviterId: string;
    inviterName?: string;
    email?: string;
    phone?: string;
    name?: string;
    vehicleId: string;
    serviceCenterId: string;
    role?: string;
    accessLevel?: string;
    permissions?: string[];
    message?: string;
  }): Promise<any> {
    return Invitation.createVehicleAccess(input);
  }
}

export const invitationService = new InvitationService();
