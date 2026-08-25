import mongoose from "mongoose";
import { Subscription } from "../models/Subscription";
import { Payment } from "../models/Payment";
import { Invoice } from "../models/Invoice";
import { Tenant } from "../models/Tenant";
import { ServiceCenter } from "../models/ServiceCenter";
import { Account } from "../models/Account";
import { logger } from "../config/logger";

export interface RazorpayPaymentEntity {
  id: string;
  amount: number; // smallest currency subunit (paise/cents)
  currency: string;
  email?: string;
  contact?: string;
  status: string;
  order_id?: string;
  error_description?: string;
}

export interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
}

function addInterval(date: Date, interval: "month" | "year"): Date {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = interval === "year" ? 365 : 30;
  return new Date(date.getTime() + days * msPerDay);
}

/**
 * Orchestrates what happens across Payment/Invoice/Subscription/Tenant when
 * Razorpay tells us something happened — called exclusively from
 * webhook.controller.ts, after signature verification. Nothing else should
 * call these methods, since they represent facts Razorpay has already
 * confirmed (a client-triggered call here would be equivalent to
 * self-reporting a fake successful payment).
 */
export class BillingService {
  /**
   * subscription.charged — Razorpay successfully charged the customer for a
   * billing cycle (first charge or a renewal). Idempotent: Razorpay may
   * redeliver the same webhook, so a Payment already recorded for this
   * providerPaymentId short-circuits the rest.
   */
  async handleSubscriptionCharged(
    rzpSubscription: RazorpaySubscriptionEntity,
    rzpPayment: RazorpayPaymentEntity,
  ): Promise<void> {
    const subscription = await Subscription.findOne({
      providerSubscriptionId: rzpSubscription.id,
      isDeleted: false,
    });
    if (!subscription) {
      logger.warn({
        type: "billing_subscription_not_found",
        providerSubscriptionId: rzpSubscription.id,
      });
      return;
    }

    const alreadyProcessed = await Payment.findOne({
      providerPaymentId: rzpPayment.id,
      isDeleted: false,
    });
    if (alreadyProcessed) {
      logger.info({ type: "billing_webhook_already_processed", providerPaymentId: rzpPayment.id });
      return;
    }

    const billing = await this.resolveBillingContact(subscription.tenantId);
    if (!billing) {
      logger.error({
        type: "billing_missing_account",
        providerSubscriptionId: rzpSubscription.id,
      });
      return;
    }

    const amount = rzpPayment.amount / 100;
    const payment = await Payment.create({
      accountId: new mongoose.Types.ObjectId(billing.accountId),
      tenantId: subscription.tenantId,
      serviceCenterId: subscription.serviceCenterId,
      type: "subscription",
      status: "completed",
      amount,
      currency: rzpPayment.currency,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: amount,
      provider: "razorpay",
      providerPaymentId: rzpPayment.id,
      providerSubscriptionId: rzpSubscription.id,
      subscriptionId: subscription._id,
      billingEmail: billing.email.toLowerCase(),
      paidAt: new Date(),
      isDeleted: false,
    });

    const periodEnd = rzpSubscription.current_end
      ? new Date(rzpSubscription.current_end * 1000)
      : addInterval(new Date(), subscription.billingInterval);

    subscription.paymentIds.push(payment._id);
    await subscription.renew(periodEnd); // renew() saves; paymentIds push above rides along.

    await this.syncSubscriptionCache(subscription.tenantId, subscription.serviceCenterId, {
      status: "active",
      expiresAt: periodEnd,
    });

    logger.info({
      type: "billing_subscription_charged",
      subscriptionId: String(subscription._id),
      paymentId: String(payment._id),
    });
  }

  /** subscription.cancelled / subscription.completed */
  async handleSubscriptionEnded(
    rzpSubscription: RazorpaySubscriptionEntity,
    reason: "cancelled" | "expired",
  ): Promise<void> {
    const subscription = await Subscription.findOne({
      providerSubscriptionId: rzpSubscription.id,
      isDeleted: false,
    });
    if (!subscription) {
      logger.warn({
        type: "billing_subscription_not_found",
        providerSubscriptionId: rzpSubscription.id,
      });
      return;
    }

    subscription.status = reason;
    subscription.cancelledAt = subscription.cancelledAt ?? new Date();
    await subscription.save();

    await this.syncSubscriptionCache(subscription.tenantId, subscription.serviceCenterId, {
      status: reason === "cancelled" ? "cancelled" : "expired",
    });

    logger.info({
      type: "billing_subscription_ended",
      subscriptionId: String(subscription._id),
      reason,
    });
  }

  /**
   * payment.captured — a one-time payment succeeded. Only meaningful here
   * when it's for a Razorpay Order created by invoiceService.createPaymentOrder()
   * (the only place that stashes metadata.razorpayOrderId on a pending Payment);
   * anything else is outside billing.service's scope and ignored.
   */
  async handlePaymentCaptured(rzpPayment: RazorpayPaymentEntity): Promise<void> {
    if (!rzpPayment.order_id) return;

    const payment = await Payment.findOne({
      "metadata.razorpayOrderId": rzpPayment.order_id,
      status: "pending",
      isDeleted: false,
    });
    if (!payment) return;

    payment.status = "completed";
    payment.providerPaymentId = rzpPayment.id;
    payment.paidAt = new Date();
    await payment.save();

    if (payment.invoiceId) {
      const invoice = await Invoice.findById(payment.invoiceId);
      if (invoice) {
        await invoice.recordPayment(payment.totalAmount);
      }
    }

    logger.info({
      type: "billing_payment_captured",
      paymentId: String(payment._id),
      invoiceId: payment.invoiceId ? String(payment.invoiceId) : undefined,
    });
  }

  /** payment.failed — covers both subscription-charge failures and one-time Order payment failures. */
  async handlePaymentFailed(rzpPayment: RazorpayPaymentEntity): Promise<void> {
    let payment = await Payment.findOne({ providerPaymentId: rzpPayment.id, isDeleted: false });

    if (!payment && rzpPayment.order_id) {
      payment = await Payment.findOne({
        "metadata.razorpayOrderId": rzpPayment.order_id,
        status: "pending",
        isDeleted: false,
      });
    }

    if (payment) {
      payment.status = "failed";
      payment.failedAt = new Date();
      payment.failureReason = rzpPayment.error_description ?? "Payment failed";
      await payment.save();
    }

    if (payment?.subscriptionId) {
      const subscription = await Subscription.findById(payment.subscriptionId);
      if (subscription) {
        subscription.status = "past_due";
        await subscription.save();
        await this.syncSubscriptionCache(subscription.tenantId, subscription.serviceCenterId, {
          status: "suspended",
        });
      }
    }

    logger.warn({
      type: "billing_payment_failed",
      providerPaymentId: rzpPayment.id,
      paymentId: payment ? String(payment._id) : undefined,
    });
  }

  private async resolveBillingContact(
    tenantId?: mongoose.Types.ObjectId,
  ): Promise<{ accountId: string; email: string } | null> {
    if (tenantId) {
      const tenant = await Tenant.findById(tenantId);
      if (tenant?.ownerId) {
        const account = await Account.findById(tenant.ownerId);
        if (account?.email) {
          return { accountId: String(tenant.ownerId), email: account.email };
        }
      }
    }
    return null;
  }

  private async syncSubscriptionCache(
    tenantId: mongoose.Types.ObjectId | undefined,
    serviceCenterId: mongoose.Types.ObjectId | undefined,
    updates: { status: string; expiresAt?: Date },
  ): Promise<void> {
    if (tenantId) {
      await Tenant.findByIdAndUpdate(tenantId, {
        $set: {
          "subscription.status": updates.status,
          ...(updates.expiresAt && { "subscription.expiresAt": updates.expiresAt }),
        },
      });
    }
    if (serviceCenterId) {
      await ServiceCenter.findByIdAndUpdate(serviceCenterId, {
        $set: { "subscription.status": updates.status },
      });
    }
  }
}

export const billingService = new BillingService();
