// models/Invoice.ts
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { tenantPlugin } from "../middleware/tenant/tenantPlugin";

export interface IInvoice extends Document {
  tenantId?: Types.ObjectId;
  invoiceNumber: string;

  accountId: Types.ObjectId;
  serviceCenterId?: Types.ObjectId;
  serviceRecordIds: Types.ObjectId[];

  lineItems: Types.DocumentArray<{
    description?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;

  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  currency: string;

  status:
    | "draft"
    | "sent"
    | "viewed"
    | "paid"
    | "partially_paid"
    | "overdue"
    | "void"
    | "cancelled";

  issueDate: Date;
  dueDate: Date;
  paidAt?: Date;
  voidedAt?: Date;
  voidReason?: string;

  notes?: string;
  billingEmail?: string;
  billingName?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };

  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  isOverdue(): boolean;
  recalculateTotals(): void;
  recordPayment(amount: number): Promise<IInvoice>;
  markAsSent(): Promise<IInvoice>;
  void(reason?: string): Promise<IInvoice>;
}

export interface IInvoiceModel extends Model<IInvoice> {
  findByAccount(accountId: string | Types.ObjectId): mongoose.Query<IInvoice[], IInvoice>;
  findOverdue(): mongoose.Query<IInvoice[], IInvoice>;
  generateInvoiceNumber(): Promise<string>;
}

const invoiceSchema = new Schema<IInvoice, IInvoiceModel>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
    invoiceNumber: { type: String, required: true },

    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    serviceCenterId: { type: Schema.Types.ObjectId, ref: "ServiceCenter", index: true },
    serviceRecordIds: [{ type: Schema.Types.ObjectId, ref: "ServiceRecord" }],

    lineItems: [
      {
        description: String,
        quantity: { type: Number, default: 1, min: 0 },
        unitPrice: { type: Number, default: 0, min: 0 },
        total: { type: Number, default: 0, min: 0 },
      },
    ],

    subtotal: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },

    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "viewed",
        "paid",
        "partially_paid",
        "overdue",
        "void",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },

    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true, index: true },
    paidAt: Date,
    voidedAt: Date,
    voidReason: String,

    notes: String,
    billingEmail: String,
    billingName: String,
    billingAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
    },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Indexes
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ accountId: 1, status: 1 });
invoiceSchema.index({ serviceCenterId: 1, issueDate: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

// Methods
invoiceSchema.methods.isOverdue = function (this: IInvoice): boolean {
  return (
    ["sent", "viewed", "partially_paid"].includes(this.status) &&
    this.dueDate < new Date()
  );
};

invoiceSchema.methods.recalculateTotals = function (this: IInvoice): void {
  this.subtotal = this.lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
  this.totalAmount = Math.max(0, this.subtotal + this.taxAmount - this.discountAmount);
  this.amountDue = Math.max(0, this.totalAmount - this.amountPaid);
};

invoiceSchema.methods.recordPayment = async function (
  this: IInvoice,
  amount: number,
): Promise<IInvoice> {
  this.amountPaid += amount;
  this.amountDue = Math.max(0, this.totalAmount - this.amountPaid);
  this.status = this.amountDue === 0 ? "paid" : "partially_paid";
  if (this.status === "paid") this.paidAt = new Date();
  return this.save();
};

invoiceSchema.methods.markAsSent = async function (this: IInvoice): Promise<IInvoice> {
  if (this.status === "draft") this.status = "sent";
  return this.save();
};

invoiceSchema.methods.void = async function (
  this: IInvoice,
  reason?: string,
): Promise<IInvoice> {
  this.status = "void";
  this.voidedAt = new Date();
  this.voidReason = reason;
  return this.save();
};

// Pre-save: keep totals consistent whenever line items or payments change.
invoiceSchema.pre("save", function (this: IInvoice, next) {
  if (this.isModified("lineItems") || this.isModified("taxAmount") || this.isModified("discountAmount")) {
    this.recalculateTotals();
  }
  if (
    ["sent", "viewed", "partially_paid"].includes(this.status) &&
    this.dueDate < new Date()
  ) {
    this.status = "overdue";
  }
  next();
});

// Static methods
invoiceSchema.statics.findByAccount = function (
  this: IInvoiceModel,
  accountId: string | Types.ObjectId,
) {
  return this.find({ accountId, isDeleted: false }).sort({ issueDate: -1 });
};

invoiceSchema.statics.findOverdue = function (this: IInvoiceModel) {
  return this.find({
    status: { $in: ["sent", "viewed", "partially_paid"] },
    dueDate: { $lt: new Date() },
    isDeleted: false,
  }).sort({ dueDate: 1 });
};

// Not concurrency-safe (read-then-write on a shared counter) — fine for the
// current single-writer seed/admin flows; move to an atomic counter document
// if invoices start being created from concurrent request handlers.
invoiceSchema.statics.generateInvoiceNumber = async function (
  this: IInvoiceModel,
): Promise<string> {
  const year = new Date().getFullYear();
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  const count = await this.countDocuments({ issueDate: { $gte: start, $lt: end } });
  return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
};

invoiceSchema.plugin(tenantPlugin);

export const Invoice = mongoose.model<IInvoice, IInvoiceModel>("Invoice", invoiceSchema);
