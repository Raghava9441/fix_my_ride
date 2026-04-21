import { Payment } from "../models/Payment";
import { Account } from "../models/Account";
import { ServiceCenter } from "../models/ServiceCenter";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import mongoose from "mongoose";

export interface CreatePaymentInput {
  accountId: string;
  serviceCenterId?: string;
  tenantId?: string;
  type: "subscription" | "invoice" | "one_time" | "refund";
  amount: number;
  currency?: string;
  taxAmount?: number;
  discountAmount?: number;
  provider: "stripe" | "paypal" | "razorpay" | "bank_transfer" | "cash";
  providerPaymentId?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  serviceRecordIds?: string[];
  description?: string;
  metadata?: Record<string, any>;
  billingEmail: string;
  billingName?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface PaymentFilters {
  page?: number;
  limit?: number;
  accountId?: string;
  serviceCenterId?: string;
  tenantId?: string;
  type?: string;
  status?: string;
  provider?: string;
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

export class PaymentService {
  async findAll(filters?: PaymentFilters): Promise<PaginatedResult<any>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (filters?.accountId) query.accountId = filters.accountId;
    if (filters?.serviceCenterId)
      query.serviceCenterId = filters.serviceCenterId;
    if (filters?.tenantId) query.tenantId = filters.tenantId;
    if (filters?.type) query.type = filters.type;
    if (filters?.status) query.status = filters.status;
    if (filters?.provider) query.provider = filters.provider;
    if (filters?.startDate || filters?.endDate) {
      query.createdAt = {};
      if (filters?.startDate) query.createdAt.$gte = filters.startDate;
      if (filters?.endDate) query.createdAt.$lte = filters.endDate;
    }

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("accountId", "email")
        .populate("serviceCenterId", "name")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Payment.countDocuments(query),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<any | null> {
    return Payment.findById(id)
      .populate("accountId", "email phone")
      .populate("serviceCenterId", "name")
      .populate("serviceRecordIds", "serviceDate serviceType cost.total");
  }

  async findByAccount(accountId: string): Promise<any[]> {
    return Payment.find({ accountId, isDeleted: false })
      .populate("serviceCenterId", "name")
      .sort({ createdAt: -1 });
  }

  async findByServiceCenter(serviceCenterId: string): Promise<any[]> {
    return Payment.find({ serviceCenterId, isDeleted: false })
      .populate("accountId", "email")
      .sort({ createdAt: -1 });
  }

  async findByProviderPaymentId(
    providerPaymentId: string,
  ): Promise<any | null> {
    return Payment.findOne({ providerPaymentId, isDeleted: false });
  }

  async create(input: CreatePaymentInput): Promise<any> {
    const account = await Account.findById(input.accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const taxAmount = input.taxAmount || input.amount * 0.1;
    const discountAmount = input.discountAmount || 0;
    const totalAmount = input.amount - discountAmount + taxAmount;

    const payment = await Payment.create({
      accountId: new mongoose.Types.ObjectId(input.accountId),
      serviceCenterId: input.serviceCenterId
        ? new mongoose.Types.ObjectId(input.serviceCenterId)
        : undefined,
      tenantId: input.tenantId
        ? new mongoose.Types.ObjectId(input.tenantId)
        : undefined,
      type: input.type,
      status: "pending",
      amount: input.amount,
      currency: input.currency || "USD",
      taxAmount,
      discountAmount,
      totalAmount,
      provider: input.provider,
      providerPaymentId: input.providerPaymentId,
      providerCustomerId: input.providerCustomerId,
      providerSubscriptionId: input.providerSubscriptionId,
      invoiceId: input.invoiceId,
      subscriptionId: input.subscriptionId,
      serviceRecordIds:
        input.serviceRecordIds?.map((id) => new mongoose.Types.ObjectId(id)) ||
        [],
      description: input.description,
      metadata: input.metadata || {},
      billingEmail: input.billingEmail.toLowerCase(),
      billingName: input.billingName,
      billingAddress: input.billingAddress,
      isDeleted: false,
    });

    return payment;
  }

  async markAsCompleted(id: string, providerPaymentId?: string): Promise<any> {
    const payment = await Payment.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          status: "completed",
          paidAt: new Date(),
          ...(providerPaymentId && { providerPaymentId }),
        },
      },
      { new: true },
    );

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.type === "subscription" && payment.serviceCenterId) {
      const { ServiceCenter } = await import("../models/ServiceCenter");
      await ServiceCenter.findByIdAndUpdate(payment.serviceCenterId, {
        $set: { "subscription.status": "active" },
      });
    }

    return payment;
  }

  async markAsFailed(id: string, failureReason: string): Promise<any> {
    const payment = await Payment.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        $set: {
          status: "failed",
          failedAt: new Date(),
          failureReason,
        },
      },
      { new: true },
    );

    if (!payment) {
      throw new Error("Payment not found");
    }

    return payment;
  }

  async refund(id: string, amount: number, reason?: string): Promise<any> {
    const payment = await Payment.findById(id);
    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "completed") {
      throw new Error("Can only refund completed payments");
    }

    payment.status = "refunded";
    payment.refundAmount = amount;
    payment.refundReason = reason;
    payment.refundAt = new Date();

    await payment.save();
    return payment;
  }

  async delete(id: string): Promise<any | null> {
    const payment = await Payment.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    return payment;
  }

  async getRevenueReport(
    serviceCenterId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const result = await Payment.aggregate([
      {
        $match: {
          serviceCenterId: new mongoose.Types.ObjectId(serviceCenterId),
          status: "completed",
          createdAt: { $gte: startDate, $lte: endDate },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalRevenue: { $sum: "$totalAmount" },
          totalTransactions: { $sum: 1 },
          totalTax: { $sum: "$taxAmount" },
          totalDiscount: { $sum: "$discountAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result;
  }

  async getPaymentStats(
    accountId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const match: any = { accountId: accountId, isDeleted: false };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = startDate;
      if (endDate) match.createdAt.$lte = endDate;
    }

    const result = await Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          total: { $sum: 1 },
          amount: { $sum: "$totalAmount" },
        },
      },
    ]);

    return result;
  }
}

export const paymentService = new PaymentService();
