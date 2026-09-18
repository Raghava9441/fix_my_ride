import ExcelJS from "exceljs";
import { Invoice } from "../models/Invoice";
import { Account } from "../models/Account";
import { ServiceRecord } from "../models/ServiceRecord";
import { OwnerProfile } from "../models/OwnerProfile";
import { getRazorpayClient } from "../config/razorpay";
import { paymentService } from "./payment.service";
import mongoose from "mongoose";

export interface CreateInvoiceInput {
  tenantId?: string;
  accountId: string;
  serviceCenterId?: string;
  serviceRecordIds?: string[];
  lineItems: Array<{ description?: string; quantity: number; unitPrice: number }>;
  taxAmount?: number;
  discountAmount?: number;
  dueDate: Date;
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
}

export interface GenerateFromServiceRecordOptions {
  /** ISO date string; defaults to DEFAULT_DUE_IN_DAYS from today. */
  dueDate?: string;
  /** Percentage applied to the line-item subtotal; falls back to the record's own tax. */
  taxRate?: number;
  discountAmount?: number;
  notes?: string;
}

/** Statuses that still represent a live invoice for duplicate-generation purposes. */
const NON_VOID_STATUSES = ["draft", "sent", "viewed", "paid", "partially_paid", "overdue"];

const DEFAULT_DUE_IN_DAYS = 30;

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  accountId?: string;
  serviceCenterId?: string;
  tenantId?: string;
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

export class InvoiceService {
  async findAll(filters?: InvoiceFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.accountId) query.accountId = filters.accountId;
    if (filters?.serviceCenterId) query.serviceCenterId = filters.serviceCenterId;
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.status) query.status = filters.status;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate("accountId", "email")
        .populate("serviceCenterId", "name")
        .skip(skip)
        .limit(limit)
        .sort({ issueDate: -1 }),
      Invoice.countDocuments(query),
    ]);

    return {
      data: invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Invoice.findById(id)
      .populate("accountId", "email")
      .populate("serviceCenterId", "name")
      .populate("serviceRecordIds", "serviceDate serviceType");
  }

  async findByAccount(accountId: string): Promise<any[]> {
    return Invoice.findByAccount(accountId);
  }

  async findOverdue(): Promise<any[]> {
    return Invoice.findOverdue();
  }

  async create(input: CreateInvoiceInput): Promise<any> {
    const invoiceNumber = await Invoice.generateInvoiceNumber();

    const lineItems = input.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = input.taxAmount ?? 0;
    const discountAmount = input.discountAmount ?? 0;
    const totalAmount = Math.max(0, subtotal + taxAmount - discountAmount);

    return Invoice.create({
      tenantId: input.tenantId ? new mongoose.Types.ObjectId(input.tenantId) : undefined,
      invoiceNumber,
      accountId: new mongoose.Types.ObjectId(input.accountId),
      serviceCenterId: input.serviceCenterId
        ? new mongoose.Types.ObjectId(input.serviceCenterId)
        : undefined,
      serviceRecordIds:
        input.serviceRecordIds?.map((id) => new mongoose.Types.ObjectId(id)) ?? [],
      lineItems,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      amountPaid: 0,
      amountDue: totalAmount,
      dueDate: input.dueDate,
      notes: input.notes,
      billingEmail: input.billingEmail,
      billingName: input.billingName,
      billingAddress: input.billingAddress,
      isDeleted: false,
    });
  }

  /**
   * Creates a Razorpay Order for the invoice's outstanding balance and a
   * matching pending Payment record (the only place Payment.invoiceId ever
   * gets set) — the customer completes payment against orderId via
   * Razorpay Checkout, and billing.service.ts's payment.captured webhook
   * handler finds this Payment back by its stashed razorpayOrderId and
   * calls Invoice.recordPayment().
   */
  /**
   * The invoice raised against a single service record, if one has been
   * generated. Voided/cancelled invoices are ignored so a record whose first
   * invoice was written off can be re-invoiced.
   */
  async findByServiceRecord(serviceRecordId: string): Promise<any | null> {
    return Invoice.findOne({
      serviceRecordIds: new mongoose.Types.ObjectId(serviceRecordId),
      status: { $in: NON_VOID_STATUSES },
      isDeleted: false,
    })
      .populate("accountId", "email")
      .populate("serviceCenterId", "name")
      .sort({ issueDate: -1 });
  }

  /**
   * Builds an invoice from what the service record already stores: one line
   * per replaced part plus a single labour line, since ServiceRecord holds
   * only a `cost.laborTotal` figure rather than itemised labour. Tax and
   * discount default to the record's own figures so the invoice total
   * matches `cost.total` unless the caller overrides them.
   */
  async generateForServiceRecord(
    serviceRecordId: string,
    options: GenerateFromServiceRecordOptions = {},
  ): Promise<any> {
    const record = await ServiceRecord.findById(serviceRecordId);
    if (!record || record.isDeleted) {
      throw new Error("Service record not found");
    }

    const existing = await this.findByServiceRecord(serviceRecordId);
    if (existing) {
      throw new Error("Invoice already exists for this service record");
    }

    const owner = await OwnerProfile.findById(record.ownerId);
    if (!owner) {
      throw new Error("Owner profile not found for this service record");
    }

    // The billing address lives on OwnerProfile but the email is on the
    // linked Account — OwnerProfile has no email field of its own.
    const account = await Account.findById(owner.accountId).select("email");

    const lineItems: Array<{ description: string; quantity: number; unitPrice: number }> = [];

    for (const part of record.partsReplaced ?? []) {
      const name = part.partName ?? "Part";
      lineItems.push({
        description: part.partNumber ? `${name} (${part.partNumber})` : name,
        quantity: part.quantity ?? 1,
        unitPrice: part.unitCost ?? 0,
      });
    }

    if ((record.cost?.laborTotal ?? 0) > 0) {
      lineItems.push({ description: "Labour", quantity: 1, unitPrice: record.cost.laborTotal });
    }

    // A record can legitimately carry a total without parts or labour broken
    // out (e.g. a flat-rate job) — bill it as a single line rather than
    // producing a zero-value invoice.
    if (lineItems.length === 0) {
      lineItems.push({
        description: record.serviceType,
        quantity: 1,
        unitPrice: record.cost?.subtotal || record.cost?.total || 0,
      });
    }

    let dueDate: Date;
    if (options.dueDate) {
      dueDate = new Date(options.dueDate);
    } else {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + DEFAULT_DUE_IN_DAYS);
    }

    // taxRate is a percentage of the line-item subtotal; when the caller
    // doesn't supply one, keep the record's own absolute tax figure so the
    // invoice total still reconciles with cost.total.
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount =
      options.taxRate !== undefined
        ? Math.round(subtotal * options.taxRate) / 100
        : (record.cost?.tax ?? 0);

    return this.create({
      accountId: String(owner.accountId),
      serviceCenterId: String(record.serviceCenterId),
      serviceRecordIds: [String(record._id)],
      lineItems,
      taxAmount,
      discountAmount: options.discountAmount ?? record.cost?.discount ?? 0,
      dueDate,
      notes: options.notes,
      billingName: `${owner.firstName} ${owner.lastName}`.trim(),
      billingEmail: account?.email ?? owner.alternateEmail ?? undefined,
      billingAddress: owner.address,
    });
  }

  /**
   * Renders an invoice as a spreadsheet. xlsx rather than PDF deliberately:
   * `exceljs` is already a dependency (report.service.ts uses it for report
   * exports) whereas no PDF generator is, and report.controller.ts's export
   * endpoint documents that same gap.
   */
  async toExcel(invoice: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Invoice");

    sheet.columns = [
      { key: "a", width: 46 },
      { key: "b", width: 12 },
      { key: "c", width: 16 },
      { key: "d", width: 16 },
    ];

    const heading = sheet.addRow([`Invoice ${invoice.invoiceNumber}`]);
    heading.font = { bold: true, size: 14 };
    sheet.addRow([]);

    const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : undefined;
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : undefined;
    sheet.addRow(["Status", invoice.status]);
    sheet.addRow(["Issued", issueDate ? issueDate.toISOString().slice(0, 10) : ""]);
    sheet.addRow(["Due", dueDate ? dueDate.toISOString().slice(0, 10) : ""]);
    sheet.addRow(["Billed to", invoice.billingName ?? ""]);
    sheet.addRow(["Email", invoice.billingEmail ?? ""]);
    sheet.addRow([]);

    const header = sheet.addRow(["Description", "Qty", "Unit price", "Total"]);
    header.font = { bold: true };

    for (const item of invoice.lineItems ?? []) {
      sheet.addRow([item.description ?? "", item.quantity, item.unitPrice, item.total]);
    }

    sheet.addRow([]);
    sheet.addRow(["", "", "Subtotal", invoice.subtotal]);
    sheet.addRow(["", "", "Tax", invoice.taxAmount]);
    sheet.addRow(["", "", "Discount", invoice.discountAmount]);
    const total = sheet.addRow(["", "", "Total", invoice.totalAmount]);
    total.font = { bold: true };
    sheet.addRow(["", "", "Paid", invoice.amountPaid]);
    sheet.addRow(["", "", "Amount due", invoice.amountDue]);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async createPaymentOrder(id: string): Promise<{ invoice: any; orderId: string }> {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (invoice.amountDue <= 0) {
      throw new Error("Invoice has no amount due");
    }

    const client = getRazorpayClient();
    if (!client) {
      throw new Error("Payment provider is not configured");
    }

    let billingEmail = invoice.billingEmail;
    if (!billingEmail) {
      const account = await Account.findById(invoice.accountId);
      billingEmail = account?.email;
    }
    if (!billingEmail) {
      throw new Error("No billing email on file for this invoice's account");
    }

    const order = await client.orders.create({
      amount: Math.round(invoice.amountDue * 100),
      currency: invoice.currency,
      receipt: invoice.invoiceNumber,
      notes: { invoiceId: String(invoice._id) },
    });

    await paymentService.create({
      accountId: String(invoice.accountId),
      serviceCenterId: invoice.serviceCenterId ? String(invoice.serviceCenterId) : undefined,
      tenantId: invoice.tenantId ? String(invoice.tenantId) : undefined,
      type: "invoice",
      amount: invoice.amountDue,
      taxAmount: 0,
      discountAmount: 0,
      provider: "razorpay",
      invoiceId: String(invoice._id),
      billingEmail,
      metadata: { razorpayOrderId: order.id },
    });

    return { invoice, orderId: order.id };
  }

  async recordPayment(id: string, amount: number): Promise<any> {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    return invoice.recordPayment(amount);
  }

  async markAsSent(id: string): Promise<any> {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    return invoice.markAsSent();
  }

  async void(id: string, reason?: string): Promise<any> {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    return invoice.void(reason);
  }
}

export const invoiceService = new InvoiceService();
