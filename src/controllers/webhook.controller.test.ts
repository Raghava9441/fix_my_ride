import crypto from "crypto";
import express from "express";
import request from "supertest";
import webhookRoutes from "../routes/webhook.routes";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Account } from "../models/Account";
import { Tenant } from "../models/Tenant";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { Subscription } from "../models/Subscription";
import { Payment } from "../models/Payment";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET as string;

// A minimal app mounting just the webhook route with the same raw-body
// capture app.ts uses — deliberately not importing the full app, which
// pulls in every other route (including @scalar/express-api-reference, an
// ESM-only package Jest can't parse) that's irrelevant to this test.
function buildTestApp() {
  const app = express();
  app.use(
    express.json({
      limit: "10mb",
      verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
        (req as any).rawBody = buf;
      },
    }),
  );
  app.use("/api/v1/webhooks", webhookRoutes);
  return app;
}

const app = buildTestApp();

function sign(rawBody: string): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
}

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

const chargedPayload = {
  event: "subscription.charged",
  payload: {
    subscription: {
      entity: {
        id: "sub_test123",
        status: "active",
        current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      },
    },
    payment: {
      entity: {
        id: "pay_test123",
        amount: 2900,
        currency: "USD",
        status: "captured",
      },
    },
  },
};

describe("POST /api/v1/webhooks/razorpay", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  it("rejects a request with no signature header", async () => {
    const res = await request(app)
      .post("/api/v1/webhooks/razorpay")
      .send(chargedPayload);

    expect(res.status).toBe(400);
  });

  it("rejects a request with an invalid signature", async () => {
    const body = JSON.stringify(chargedPayload);
    const res = await request(app)
      .post("/api/v1/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "not-the-real-signature")
      .send(body);

    expect(res.status).toBe(401);
  });

  it("rejects a request whose body was tampered with after signing", async () => {
    const originalBody = JSON.stringify(chargedPayload);
    const signature = sign(originalBody);
    const tamperedBody = JSON.stringify({ ...chargedPayload, event: "subscription.cancelled" });

    const res = await request(app)
      .post("/api/v1/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(tamperedBody);

    expect(res.status).toBe(401);
  });

  it("accepts a validly signed subscription.charged event and processes it", async () => {
    const { subscription } = await makeFixtures();
    const body = JSON.stringify(chargedPayload);
    const signature = sign(body);

    const res = await request(app)
      .post("/api/v1/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(body);

    expect(res.status).toBe(200);

    const payment = await Payment.findOne({ providerPaymentId: "pay_test123" });
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe("completed");

    const updated = await Subscription.findById(subscription._id);
    expect(updated!.status).toBe("active");
  });

  it("redelivering the same valid webhook doesn't create a duplicate Payment", async () => {
    await makeFixtures();
    const body = JSON.stringify(chargedPayload);
    const signature = sign(body);

    await request(app)
      .post("/api/v1/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(body)
      .expect(200);

    await request(app)
      .post("/api/v1/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(body)
      .expect(200);

    const payments = await Payment.find({ providerPaymentId: "pay_test123" });
    expect(payments).toHaveLength(1);
  });
});
