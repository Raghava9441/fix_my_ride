// models/Reminder.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { tenantPlugin } from "../middleware/tenant/tenantPlugin";

export interface IReminder extends Document {
  tenantId?: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  serviceRecordId?: Types.ObjectId;
  ownerId?: Types.ObjectId;
  staffId?: Types.ObjectId;

  type: "service" | "insurance" | "tax" | "registration" | "custom";
  title: string;
  description?: string;
  dueDate: Date;
  priority: "low" | "medium" | "high" | "urgent";

  recurrence: {
    enabled: boolean;
    frequency?: "daily" | "weekly" | "monthly" | "yearly";
    interval: number;
    endDate?: Date;
    occurrences?: number;
  };

  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    reminderLeadTime: number;
  };

  status: "pending" | "acknowledged" | "snoozed" | "completed" | "cancelled";
  acknowledgedAt?: Date;
  snoozedUntil?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  lastNotifiedAt?: Date;
  notificationCount: number;

  createdBy?: Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  isOverdue(): boolean;
  acknowledge(): Promise<IReminder>;
  snooze(until: Date): Promise<IReminder>;
  complete(): Promise<IReminder>;
  cancel(): Promise<IReminder>;
  scheduleNextOccurrence(): Promise<IReminder | null>;
}

export interface IReminderModel extends Model<IReminder> {
  findUpcoming(
    ownerId: string | Types.ObjectId,
    days?: number,
  ): mongoose.Query<IReminder[], IReminder>;
  findOverdue(
    ownerId?: string | Types.ObjectId,
  ): mongoose.Query<IReminder[], IReminder>;
}

const reminderSchema = new Schema<IReminder, IReminderModel>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },

    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", index: true },
    serviceRecordId: { type: Schema.Types.ObjectId, ref: "ServiceRecord" },
    ownerId: { type: Schema.Types.ObjectId, ref: "OwnerProfile", index: true },
    staffId: { type: Schema.Types.ObjectId, ref: "StaffProfile" },

    type: {
      type: String,
      required: true,
      enum: ["service", "insurance", "tax", "registration", "custom"],
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: String,
    dueDate: { type: Date, required: true, index: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    recurrence: {
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ["daily", "weekly", "monthly", "yearly"] },
      interval: { type: Number, default: 1, min: 1 },
      endDate: Date,
      occurrences: Number,
    },

    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      reminderLeadTime: { type: Number, default: 24, min: 0 },
    },

    status: {
      type: String,
      enum: ["pending", "acknowledged", "snoozed", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    acknowledgedAt: Date,
    snoozedUntil: Date,
    completedAt: Date,
    cancelledAt: Date,
    lastNotifiedAt: Date,
    notificationCount: { type: Number, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: "Account" },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Indexes
reminderSchema.index({ ownerId: 1, dueDate: 1 });
reminderSchema.index({ vehicleId: 1, dueDate: 1 });
reminderSchema.index({ status: 1, dueDate: 1 });

// Methods
reminderSchema.methods.isOverdue = function (this: IReminder): boolean {
  return this.status === "pending" && this.dueDate < new Date();
};

reminderSchema.methods.acknowledge = async function (
  this: IReminder,
): Promise<IReminder> {
  this.status = "acknowledged";
  this.acknowledgedAt = new Date();
  return this.save();
};

reminderSchema.methods.snooze = async function (
  this: IReminder,
  until: Date,
): Promise<IReminder> {
  this.status = "snoozed";
  this.snoozedUntil = until;
  return this.save();
};

reminderSchema.methods.complete = async function (
  this: IReminder,
): Promise<IReminder> {
  this.status = "completed";
  this.completedAt = new Date();
  return this.save();
};

reminderSchema.methods.cancel = async function (
  this: IReminder,
): Promise<IReminder> {
  this.status = "cancelled";
  this.cancelledAt = new Date();
  return this.save();
};

reminderSchema.methods.scheduleNextOccurrence = async function (
  this: IReminder,
): Promise<IReminder | null> {
  if (!this.recurrence?.enabled || !this.recurrence.frequency) return null;

  const unitMs: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    yearly: 365 * 24 * 60 * 60 * 1000,
  };
  const step = unitMs[this.recurrence.frequency] * (this.recurrence.interval || 1);
  const nextDue = new Date(this.dueDate.getTime() + step);

  if (this.recurrence.endDate && nextDue > this.recurrence.endDate) return null;

  const Reminder = this.constructor as IReminderModel;
  return Reminder.create({
    tenantId: this.tenantId,
    vehicleId: this.vehicleId,
    ownerId: this.ownerId,
    staffId: this.staffId,
    type: this.type,
    title: this.title,
    description: this.description,
    dueDate: nextDue,
    priority: this.priority,
    recurrence: this.recurrence,
    notificationPreferences: this.notificationPreferences,
    createdBy: this.createdBy,
  });
};

// Static methods
reminderSchema.statics.findUpcoming = function (
  this: IReminderModel,
  ownerId: string | Types.ObjectId,
  days = 7,
) {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return this.find({
    ownerId,
    status: "pending",
    isDeleted: false,
    dueDate: { $gte: new Date(), $lte: cutoff },
  }).sort({ dueDate: 1 });
};

reminderSchema.statics.findOverdue = function (
  this: IReminderModel,
  ownerId?: string | Types.ObjectId,
) {
  const query: Record<string, unknown> = {
    status: "pending",
    isDeleted: false,
    dueDate: { $lt: new Date() },
  };
  if (ownerId) query.ownerId = ownerId;
  return this.find(query).sort({ dueDate: 1 });
};

reminderSchema.plugin(tenantPlugin);

export const Reminder = mongoose.model<IReminder, IReminderModel>(
  "Reminder",
  reminderSchema,
);
