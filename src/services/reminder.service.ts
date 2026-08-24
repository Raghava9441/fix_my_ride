import { Reminder } from "../models/Reminder";
import mongoose from "mongoose";

export interface CreateReminderInput {
  tenantId?: string;
  vehicleId?: string;
  serviceRecordId?: string;
  ownerId?: string;
  staffId?: string;
  type: "service" | "insurance" | "tax" | "registration" | "custom";
  title: string;
  description?: string;
  dueDate: string;
  priority?: "low" | "medium" | "high" | "urgent";
  recurrence?: {
    enabled?: boolean;
    frequency?: "daily" | "weekly" | "monthly" | "yearly";
    interval?: number;
    endDate?: string;
    occurrences?: number;
  };
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    reminderLeadTime?: number;
  };
  createdBy?: string;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  recurrence?: {
    enabled?: boolean;
    frequency?: "daily" | "weekly" | "monthly" | "yearly";
    interval?: number;
    endDate?: string;
    occurrences?: number;
  };
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    reminderLeadTime?: number;
  };
}

export interface ReminderFilters {
  page?: number;
  limit?: number;
  ownerId?: string;
  vehicleId?: string;
  staffId?: string;
  status?: string;
  type?: string;
  priority?: string;
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

export class ReminderService {
  async findAll(filters?: ReminderFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.ownerId) query.ownerId = filters.ownerId;
    if (filters?.vehicleId) query.vehicleId = filters.vehicleId;
    if (filters?.staffId) query.staffId = filters.staffId;
    if (filters?.status) query.status = filters.status;
    if (filters?.type) query.type = filters.type;
    if (filters?.priority) query.priority = filters.priority;

    const [reminders, total] = await Promise.all([
      Reminder.find(query)
        .populate("vehicleId", "registrationNumber make model")
        .populate("ownerId", "firstName lastName")
        .skip(skip)
        .limit(limit)
        .sort({ dueDate: 1 }),
      Reminder.countDocuments(query),
    ]);

    return {
      data: reminders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Reminder.findOne({ _id: id, isDeleted: false })
      .populate("vehicleId", "registrationNumber make model")
      .populate("ownerId", "firstName lastName")
      .populate("staffId", "employeeId");
  }

  async findUpcoming(ownerId: string, days?: number): Promise<any[]> {
    return Reminder.findUpcoming(ownerId, days);
  }

  async findOverdue(ownerId?: string): Promise<any[]> {
    return Reminder.findOverdue(ownerId);
  }

  async create(input: CreateReminderInput): Promise<any> {
    const reminder = await Reminder.create({
      tenantId: input.tenantId ? new mongoose.Types.ObjectId(input.tenantId) : undefined,
      vehicleId: input.vehicleId ? new mongoose.Types.ObjectId(input.vehicleId) : undefined,
      serviceRecordId: input.serviceRecordId
        ? new mongoose.Types.ObjectId(input.serviceRecordId)
        : undefined,
      ownerId: input.ownerId ? new mongoose.Types.ObjectId(input.ownerId) : undefined,
      staffId: input.staffId ? new mongoose.Types.ObjectId(input.staffId) : undefined,
      type: input.type,
      title: input.title,
      description: input.description,
      dueDate: new Date(input.dueDate),
      priority: input.priority || "medium",
      recurrence: input.recurrence
        ? {
            enabled: input.recurrence.enabled ?? false,
            frequency: input.recurrence.frequency,
            interval: input.recurrence.interval ?? 1,
            endDate: input.recurrence.endDate ? new Date(input.recurrence.endDate) : undefined,
            occurrences: input.recurrence.occurrences,
          }
        : undefined,
      notificationPreferences: input.notificationPreferences,
      createdBy: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : undefined,
      isDeleted: false,
    });

    return reminder;
  }

  async update(id: string, updates: UpdateReminderInput): Promise<any | null> {
    const set: any = { ...updates };
    if (updates.dueDate) set.dueDate = new Date(updates.dueDate);
    if (updates.recurrence?.endDate) {
      set.recurrence = { ...updates.recurrence, endDate: new Date(updates.recurrence.endDate) };
    }

    return Reminder.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: set },
      { new: true, runValidators: true },
    );
  }

  async delete(id: string): Promise<any | null> {
    return Reminder.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true },
    );
  }

  async acknowledge(id: string): Promise<any> {
    const reminder = await Reminder.findOne({ _id: id, isDeleted: false });
    if (!reminder) throw new Error("Reminder not found");
    return reminder.acknowledge();
  }

  async snooze(id: string, until: string): Promise<any> {
    const reminder = await Reminder.findOne({ _id: id, isDeleted: false });
    if (!reminder) throw new Error("Reminder not found");
    return reminder.snooze(new Date(until));
  }

  async complete(id: string): Promise<any> {
    const reminder = await Reminder.findOne({ _id: id, isDeleted: false });
    if (!reminder) throw new Error("Reminder not found");
    await reminder.complete();
    await reminder.scheduleNextOccurrence();
    return reminder;
  }

  async cancel(id: string): Promise<any> {
    const reminder = await Reminder.findOne({ _id: id, isDeleted: false });
    if (!reminder) throw new Error("Reminder not found");
    return reminder.cancel();
  }

  async bulkAcknowledge(ids: string[]): Promise<{ acknowledged: number }> {
    const result = await Reminder.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      { $set: { status: "acknowledged", acknowledgedAt: new Date() } },
    );
    return { acknowledged: result.modifiedCount };
  }

  async bulkCancel(ids: string[]): Promise<{ cancelled: number }> {
    const result = await Reminder.updateMany(
      { _id: { $in: ids }, isDeleted: false },
      { $set: { status: "cancelled", cancelledAt: new Date() } },
    );
    return { cancelled: result.modifiedCount };
  }
}

export const reminderService = new ReminderService();
