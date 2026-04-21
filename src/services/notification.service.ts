import { Notification } from "../models/Notification";
import mongoose from "mongoose";

export interface CreateNotificationInput {
  recipientId: string;
  recipientModel: "Owner" | "User" | "ServiceCenter";
  title: string;
  content: string;
  channel: "email" | "sms" | "push" | "in_app";
  type: string;
  data?: {
    vehicleId?: string;
    serviceRecordId?: string;
    serviceCenterId?: string;
    invitationId?: string;
    amount?: number;
    currency?: string;
    dueDate?: Date;
    scheduledDate?: Date;
    customData?: Record<string, any>;
  };
  priority?: "low" | "medium" | "high" | "urgent";
  templateId?: string;
  provider?: string;
}

export interface NotificationFilters {
  page?: number;
  limit?: number;
  recipientId?: string;
  recipientModel?: string;
  channel?: string;
  type?: string;
  status?: string;
  unreadOnly?: boolean;
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

export class NotificationService {
  async findAll(filters?: NotificationFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.recipientId) query.recipientId = filters.recipientId;
    if (filters?.recipientModel) query.recipientModel = filters.recipientModel;
    if (filters?.channel) query.channel = filters.channel;
    if (filters?.type) query.type = filters.type;
    if (filters?.status) query.status = filters.status;
    if (filters?.unreadOnly) query.status = { $ne: "read" };

    const [notifications, total] = await Promise.all([
      Notification.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Notification.countDocuments(query),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Notification.findById(id);
  }

  async findByRecipient(
    recipientId: string,
    recipientModel: string,
    options?: {
      limit?: number;
      skip?: number;
      status?: string;
      type?: string;
      channel?: string;
      unreadOnly?: boolean;
    },
  ): Promise<any[]> {
    return Notification.findByRecipient(recipientId, recipientModel, options);
  }

  async findUnread(
    recipientId: string,
    recipientModel: string,
  ): Promise<any[]> {
    return Notification.findUnreadByRecipient(recipientId, recipientModel);
  }

  async create(input: CreateNotificationInput): Promise<any> {
    const notification = await Notification.create({
      recipientId: new mongoose.Types.ObjectId(input.recipientId),
      recipientModel: input.recipientModel,
      title: input.title,
      content: input.content,
      channel: input.channel,
      type: input.type,
      data: input.data || {},
      priority: input.priority || "medium",
      status: "pending",
      templateId: input.templateId,
      provider: input.provider || "internal",
      isDeleted: false,
    });

    return notification;
  }

  async markAsSent(id: string, providerMessageId?: string): Promise<any> {
    const notification = await Notification.findById(id);
    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification.markAsSent(providerMessageId);
  }

  async markAsDelivered(id: string): Promise<any> {
    const notification = await Notification.findById(id);
    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification.markAsDelivered();
  }

  async markAsRead(id: string): Promise<any> {
    const notification = await Notification.findById(id);
    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification.markAsRead();
  }

  async markAsClicked(id: string): Promise<any> {
    const notification = await Notification.findById(id);
    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification.markAsClicked();
  }

  async markAsFailed(id: string, reason: string): Promise<any> {
    const notification = await Notification.findById(id);
    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification.markAsFailed(reason);
  }

  async markAllAsRead(
    recipientId: string,
    recipientModel: string,
  ): Promise<any> {
    return Notification.markAllAsRead(
      new mongoose.Types.ObjectId(recipientId),
      recipientModel,
    );
  }

  async delete(id: string): Promise<any | null> {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    return notification;
  }

  async deleteOld(daysToKeep: number = 90): Promise<any> {
    return Notification.deleteOldNotifications(daysToKeep);
  }

  async getStats(recipientId: string, recipientModel: string): Promise<any[]> {
    return Notification.getNotificationStats(recipientId, recipientModel);
  }

  async createFromTemplate(
    template: {
      id?: string;
      title: string;
      content: string;
      channel: string;
      type: string;
      version?: number;
      priority?: string;
    },
    recipient: { id: string; model: string },
    data: Record<string, any>,
  ): Promise<any> {
    return Notification.createFromTemplate(template, recipient, data);
  }

  async queueNotification(input: CreateNotificationInput): Promise<any> {
    return this.create({
      ...input,
      status: "queued",
    });
  }

  async sendBatch(
    notifications: CreateNotificationInput[],
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const notif of notifications) {
      try {
        await this.create({ ...notif, status: "queued" });
        sent++;
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  }
}

export const notificationService = new NotificationService();
