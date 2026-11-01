import mongoose from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { ServiceRecord } from "../models/ServiceRecord";
import { ServiceCenter } from "../models/ServiceCenter";
import { canTransition, InvalidTransitionError } from "./serviceRecordTransitions";
import { serviceRecordService } from "./serviceRecord.service";

// Notifications mirror to WhatsApp; irrelevant here.
jest.mock("./notification.service", () => ({ notificationService: { create: jest.fn().mockResolvedValue({}) } }));

const oid = () => new mongoose.Types.ObjectId();

async function makeCenter() {
  const _id = oid();
  await ServiceCenter.collection.insertOne({ _id, name: "Main", stats: { totalServiceRecords: 0, totalRevenue: 0 } });
  return _id;
}

async function makeJob(serviceCenterId: mongoose.Types.ObjectId, overrides: Record<string, unknown> = {}) {
  const _id = oid();
  await ServiceRecord.collection.insertOne({
    _id,
    vehicleId: oid(),
    serviceCenterId,
    ownerId: oid(),
    serviceDate: new Date(),
    serviceType: "repair",
    description: "x",
    odometerReading: { value: 1000, unit: "km" },
    cost: { total: 500, currency: "INR" },
    status: "scheduled",
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return _id;
}

describe("canTransition", () => {
  it("allows the normal flow and the two undo moves", () => {
    expect(canTransition("scheduled", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("in_progress", "scheduled")).toBe(true);
    expect(canTransition("cancelled", "scheduled")).toBe(true);
  });

  it("treats completed as terminal and refuses skipping a cancelled job to done", () => {
    expect(canTransition("completed", "in_progress")).toBe(false);
    expect(canTransition("completed", "scheduled")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
  });
});

describe("serviceRecordService.updateStatus", () => {
  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  afterEach(async () => {
    await clearTestDb();
  });

  it("moves a job along its lifecycle", async () => {
    const center = await makeCenter();
    const id = await makeJob(center);

    expect((await serviceRecordService.updateStatus(String(id), "in_progress")).status).toBe("in_progress");
    expect((await serviceRecordService.updateStatus(String(id), "completed")).status).toBe("completed");
  });

  it("books a completed job's revenue against the center exactly once, however often it is completed", async () => {
    const center = await makeCenter();
    const id = await makeJob(center, { status: "in_progress" });

    await serviceRecordService.updateStatus(String(id), "completed");
    // A double-click, or a retry after a slow response.
    await serviceRecordService.updateStatus(String(id), "completed");

    const doc: any = await ServiceCenter.collection.findOne({ _id: center });
    expect(doc.stats.totalServiceRecords).toBe(1);
    expect(doc.stats.totalRevenue).toBe(500);
  });

  it("books it once even when two completions race", async () => {
    const center = await makeCenter();
    const id = await makeJob(center, { status: "in_progress" });

    const results = await Promise.allSettled([
      serviceRecordService.updateStatus(String(id), "completed"),
      serviceRecordService.updateStatus(String(id), "completed"),
    ]);

    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    const doc: any = await ServiceCenter.collection.findOne({ _id: center });
    expect(doc.stats.totalServiceRecords).toBe(1);
  });

  it("refuses to reopen a completed job, since its one-time effects can't be undone", async () => {
    const center = await makeCenter();
    const id = await makeJob(center, { status: "completed" });

    await expect(serviceRecordService.updateStatus(String(id), "in_progress")).rejects.toBeInstanceOf(
      InvalidTransitionError,
    );
    expect(((await ServiceRecord.collection.findOne({ _id: id })) as any).status).toBe("completed");
  });

  it("reports a missing job as not found", async () => {
    await expect(serviceRecordService.updateStatus(String(oid()), "in_progress")).rejects.toThrow(
      "Service record not found",
    );
  });
});

describe("serviceRecordService.getQueue", () => {
  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  afterEach(async () => {
    await clearTestDb();
  });

  it("groups one center's jobs into lanes and keeps other centers out", async () => {
    const mine = await makeCenter();
    const other = await makeCenter();
    await makeJob(mine, { status: "scheduled" });
    await makeJob(mine, { status: "scheduled" });
    await makeJob(mine, { status: "in_progress" });
    await makeJob(mine, { status: "completed" });
    await makeJob(mine, { status: "completed", updatedAt: new Date(Date.now() - 3 * 86_400_000) });
    await makeJob(mine, { status: "cancelled" });
    await makeJob(other, { status: "in_progress" });

    const queue = await serviceRecordService.getQueue(String(mine));

    expect(queue.scheduled).toHaveLength(2);
    expect(queue.inProgress).toHaveLength(1);
    // Only what finished today; older completions and cancellations don't belong on a live board.
    expect(queue.completedToday).toHaveLength(1);
    expect(queue.counts).toEqual({ scheduled: 2, inProgress: 1, completedToday: 1 });
  });

  it("truncates a lane but still reports its true total", async () => {
    const center = await makeCenter();
    for (let i = 0; i < 5; i += 1) await makeJob(center, { status: "scheduled" });

    const queue = await serviceRecordService.getQueue(String(center), { limit: 2 });

    expect(queue.scheduled).toHaveLength(2);
    expect(queue.counts.scheduled).toBe(5);
  });

  it("ignores deleted jobs", async () => {
    const center = await makeCenter();
    await makeJob(center, { status: "scheduled", isDeleted: true });
    expect((await serviceRecordService.getQueue(String(center))).counts.scheduled).toBe(0);
  });
});
