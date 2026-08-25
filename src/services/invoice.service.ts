import { Invoice } from "../models/Invoice";
import { Account } from "../models/Account";
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
