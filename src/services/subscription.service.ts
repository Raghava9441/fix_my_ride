import { Subscription } from "../models/Subscription";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { Tenant } from "../models/Tenant";
import { getRazorpayClient } from "../config/razorpay";
import { logger } from "../config/logger";

export interface CreateSubscriptionInput {
  tenantId: string;
  serviceCenterId?: string;
  planId: string;
}

export interface CreateSubscriptionResult {
  subscription: any;
  /** Razorpay-hosted page the customer must visit to authorize the recurring
   * mandate — undefined for free plans, which activate immediately. */
  checkoutUrl?: string;
}

// Razorpay subscriptions have no "bill forever" option — total_count is
// required. A large cycle count is the standard workaround for an
// auto-renewing subscription that only really ends via cancellation.
const RAZORPAY_TOTAL_COUNT = 100;

function addInterval(date: Date, interval: "month" | "year"): Date {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = interval === "year" ? 365 : 30;
  return new Date(date.getTime() + days * msPerDay);
}

export class SubscriptionService {
  async findActiveForTenant(tenantId: string): Promise<any | null> {
    return Subscription.findActiveForTenant(tenantId);
  }

  async findById(id: string): Promise<any | null> {
    return Subscription.findOne({ _id: id, isDeleted: false }).populate("planId");
  }

  /**
   * Subscribes a tenant to a plan. For paid plans this creates a Razorpay
   * Subscription and returns its short_url for the customer to complete the
   * authorization payment — the local record starts in "trialing"/pending
   * state; confirming it actually activated (Razorpay's authenticated/active
   * webhook events) is billing.service.ts's job, built in the next phase.
   */
  async createFromPlan(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const plan = await SubscriptionPlan.findOne({
      _id: input.planId,
      isDeleted: false,
      isActive: true,
    });
    if (!plan) {
      throw new Error("Subscription plan not found");
    }

    const existing = await Subscription.findActiveForTenant(input.tenantId);
    if (existing) {
      throw new Error("Tenant already has an active subscription");
    }

    const now = new Date();
    const trialEndsAt =
      plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : undefined;
    const currentPeriodEnd = trialEndsAt ?? addInterval(now, plan.billingInterval);

    let providerSubscriptionId: string | undefined;
    let checkoutUrl: string | undefined;

    if (plan.price > 0) {
      if (!plan.providerPriceId) {
        throw new Error("This plan isn't registered with the payment provider yet");
      }
      const client = getRazorpayClient();
      if (!client) {
        throw new Error("Payment provider is not configured");
      }

      const rzpSubscription = await client.subscriptions.create({
        plan_id: plan.providerPriceId,
        total_count: RAZORPAY_TOTAL_COUNT,
        customer_notify: true,
        notes: { tenantId: input.tenantId },
      });
      providerSubscriptionId = rzpSubscription.id;
      checkoutUrl = rzpSubscription.short_url;
    }

    const subscription = await Subscription.create({
      tenantId: input.tenantId,
      serviceCenterId: input.serviceCenterId,
      planId: plan._id,
      status: "trialing",
      billingInterval: plan.billingInterval,
      currentPeriodStart: now,
      currentPeriodEnd,
      trialEndsAt,
      provider: plan.price > 0 ? "razorpay" : "manual",
      providerSubscriptionId,
      autoRenew: true,
    });

    // Keep the Tenant.subscription cache (used elsewhere for quick reads,
    // e.g. isWithinLimits()/canAccessFeature()) in sync.
    await Tenant.findByIdAndUpdate(input.tenantId, {
      $set: {
        "subscription.planId": plan._id,
        "subscription.status": trialEndsAt ? "trial" : "active",
        "subscription.startedAt": now,
        "subscription.expiresAt": currentPeriodEnd,
        "subscription.trialEndsAt": trialEndsAt,
      },
    });

    return { subscription, checkoutUrl };
  }

  async cancel(id: string, reason?: string, immediate = false): Promise<any> {
    const subscription = await Subscription.findOne({ _id: id, isDeleted: false });
    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.provider === "razorpay" && subscription.providerSubscriptionId) {
      const client = getRazorpayClient();
      if (client) {
        await client.subscriptions.cancel(subscription.providerSubscriptionId, !immediate);
      } else {
        logger.warn({
          type: "razorpay_cancel_skipped",
          message: "Razorpay not configured — cancelled locally only",
          subscriptionId: id,
        });
      }
    }

    await subscription.cancel(reason, immediate);

    if (immediate && subscription.tenantId) {
      await Tenant.findByIdAndUpdate(subscription.tenantId, {
        $set: { "subscription.status": "cancelled" },
      });
    }

    return subscription;
  }
}

export const subscriptionService = new SubscriptionService();
