import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { Subscription } from "../models/Subscription";
import { Payment } from "../models/Payment";
import { billingService } from "./billing.service";

async function makeFixtures() {
  const account = await Account.create({ email: "owner@example.com" });
  const plan = await SubscriptionPlan.create({
    name: "Basic",
    slug: `basic-${Date.now()}`,
    type: "basic",
    price: 29,
    billingInterval: "month",
  });
  const tenant = await Tenant.create({
    name: "Acme Garage",
    slug: `acme-${Date.now()}`,
    contactEmail: "billing@example.com",
    ownerId: account._id,
    subscription: { status: "trial" },
  });
  const subscription = await Subscription.create({
    tenantId: tenant._id,
    planId: plan._id,
    status: "trialing",
    billingInterval: "month",
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
    provider: "razorpay",
    providerSubscriptionId: "sub_test123",
  });

  return { account, plan, tenant, subscription };
}

describe("billingService.handleSubscriptionCharged", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it("creates a completed Payment, renews the Subscription, and syncs Tenant.subscription", async () => {
    const { tenant, subscription } = await makeFixtures();

    const rzpSubscription = {
      id: "sub_test123",
      status: "active",
      current_start: Math.floor(Date.now() / 1000),
      current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };
    const rzpPayment = {
      id: "pay_test123",
      amount: 2900,
      currency: "USD",
      status: "captured",
      email: "owner@example.com",
    };

    await billingService.handleSubscriptionCharged(rzpSubscription, rzpPayment);

    const payment = await Payment.findOne({ providerPaymentId: "pay_test123" });
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe("completed");
    expect(payment!.totalAmount).toBe(29);
    expect(String(payment!.subscriptionId)).toBe(String(subscription._id));

    const updatedSubscription = await Subscription.findById(subscription._id);
    expect(updatedSubscription!.status).toBe("active");
    expect(updatedSubscription!.currentPeriodEnd.getTime()).toBe(rzpSubscription.current_end * 1000);
    expect(updatedSubscription!.paymentIds.map(String)).toContain(String(payment!._id));

    const updatedTenant = await Tenant.findById(tenant._id);
    expect(updatedTenant!.subscription.status).toBe("active");
  });

  it("is idempotent — redelivering the same webhook doesn't create a second Payment", async () => {
    await makeFixtures();

    const rzpSubscription = {
      id: "sub_test123",
      status: "active",
      current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };
    const rzpPayment = {
      id: "pay_test123",
      amount: 2900,
      currency: "USD",
      status: "captured",
    };

    await billingService.handleSubscriptionCharged(rzpSubscription, rzpPayment);
    await billingService.handleSubscriptionCharged(rzpSubscription, rzpPayment);

    const payments = await Payment.find({ providerPaymentId: "pay_test123" });
    expect(payments).toHaveLength(1);
  });

  it("does nothing when no local Subscription matches the providerSubscriptionId", async () => {
    await billingService.handleSubscriptionCharged(
      { id: "sub_unknown", status: "active" },
      { id: "pay_unknown", amount: 1000, currency: "USD", status: "captured" },
    );

    const payments = await Payment.find({});
    expect(payments).toHaveLength(0);
  });
});

describe("billingService.handleSubscriptionEnded", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it("marks the Subscription cancelled and syncs Tenant.subscription.status", async () => {
    const { tenant, subscription } = await makeFixtures();

    await billingService.handleSubscriptionEnded({ id: "sub_test123", status: "cancelled" }, "cancelled");

    const updated = await Subscription.findById(subscription._id);
    expect(updated!.status).toBe("cancelled");
    expect(updated!.cancelledAt).not.toBeUndefined();

    const updatedTenant = await Tenant.findById(tenant._id);
    expect(updatedTenant!.subscription.status).toBe("cancelled");
  });
});
