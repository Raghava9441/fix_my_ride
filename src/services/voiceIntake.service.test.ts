import mongoose from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Account } from "../models/Account";
import { OwnerProfile } from "../models/OwnerProfile";
import { Vehicle } from "../models/Vehicle";
import { ServiceCenter } from "../models/ServiceCenter";
import { ServiceRecord } from "../models/ServiceRecord";
import {
  voiceIntakeService,
  extractWithRules,
  mergeDraft,
  evaluateDraft,
  sanitizeExtraction,
} from "./voiceIntake.service";
import { VoiceDraft } from "../dto/voice-intake.dto";

const FULL: VoiceDraft = {
  owner: { firstName: "Ravi", lastName: "Kumar", phone: "9876543210" },
  vehicle: {
    registrationNumber: "KA01AB1234",
    make: "Maruti",
    model: "Swift",
    year: 2019,
    fuelType: "petrol",
    odometer: 45000,
  },
  job: { serviceType: "oil_change", description: "Oil change and general checkup" },
};

describe("voice intake - pure helpers", () => {
  it("extracts plate, phone, odometer, year, fuel and service type from plain speech", () => {
    const out = extractWithRules(
      "ka 01 ab 1234 swift 2019 petrol, 45,000 km, number 98765 43210, oil change please",
    );
    expect(out.vehicle).toMatchObject({
      registrationNumber: "KA01AB1234",
      year: 2019,
      fuelType: "petrol",
      odometer: 45000,
    });
    expect(out.owner?.phone).toBe("9876543210");
    expect(out.job?.serviceType).toBe("oil_change");
  });

  it("does not read the odometer as a phone number or year", () => {
    const out = extractWithRules("odometer 120000 km");
    expect(out.owner?.phone).toBeUndefined();
    expect(out.vehicle?.year).toBeUndefined();
    expect(out.vehicle?.odometer).toBe(120000);
  });

  it("merge keeps known fields and ignores empty values from the model", () => {
    const merged = mergeDraft(FULL, {
      owner: { firstName: "" as any, phone: "9000000000" },
      vehicle: { odometer: null as any },
    });
    expect(merged.owner.firstName).toBe("Ravi");
    expect(merged.owner.phone).toBe("9000000000");
    expect(merged.vehicle.odometer).toBe(45000);
  });

  it("sanitize drops only the bad fields and normalises the plate", () => {
    const out = sanitizeExtraction({
      owner: { firstName: "Asha" },
      vehicle: { registrationNumber: "ka 01-ab 1234", year: "twenty-ish", fuelType: "Diesel", odometer: "12,000" },
    });
    expect(out.owner?.firstName).toBe("Asha");
    expect(out.vehicle).toEqual({ registrationNumber: "KA01AB1234", fuelType: "diesel", odometer: 12000 });
  });

  it("asks for missing fields in order and is ready only when none are left", () => {
    const partial = evaluateDraft({ owner: { firstName: "Ravi" }, vehicle: {}, job: {} });
    expect(partial.readyToSubmit).toBe(false);
    expect(partial.nextQuestion).toMatch(/phone/i);

    const full = evaluateDraft(FULL);
    expect(full.readyToSubmit).toBe(true);
    expect(full.nextQuestion).toBeNull();
    expect(full.summary).toContain("KA01AB1234");
  });
});

describe("voiceIntakeService.parse", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("uses the local LLM's answer and merges it into the draft", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            owner: { firstName: "Ravi", lastName: "Kumar" },
            vehicle: { make: "Maruti", model: "Swift" },
            job: { description: "Brake pads worn out", serviceType: "brake_service" },
          }),
        },
      }),
    }) as any;

    const res = await voiceIntakeService.parse("Ravi Kumar, Maruti Swift, KA 01 AB 1234, brake pads", {
      owner: { phone: "9876543210" },
      vehicle: {},
      job: {},
    });

    expect(res.extractor).toBe("llm");
    expect(res.draft.owner).toMatchObject({ firstName: "Ravi", phone: "9876543210" });
    expect(res.draft.vehicle).toMatchObject({ make: "Maruti", registrationNumber: "KA01AB1234" });
    expect(res.missing.map((m) => m.field)).toEqual(["vehicle.year", "vehicle.fuelType", "vehicle.odometer"]);
  });

  it("falls back to rules when the LLM is unreachable", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as any;

    const res = await voiceIntakeService.parse("KA01AB1234 diesel 80000 km");

    expect(res.extractor).toBe("rules");
    expect(res.draft.vehicle).toMatchObject({ registrationNumber: "KA01AB1234", fuelType: "diesel", odometer: 80000 });
  });
});

describe("voiceIntakeService.confirm", () => {
  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  afterEach(async () => {
    await clearTestDb();
  });

  async function makeCenter() {
    return ServiceCenter.create({
      name: "Test Garage",
      email: "garage@test.com",
      phone: "9999999999",
      address: { street: "1 Main", city: "Pune", state: "MH", country: "IN", postalCode: "411001" },
      businessRegistrationNumber: "BR-1",
      createdBy: new mongoose.Types.ObjectId(),
      subscription: { planId: new mongoose.Types.ObjectId() },
    } as any);
  }

  it("rejects an incomplete draft without writing anything", async () => {
    const center = await makeCenter();
    await expect(
      voiceIntakeService.confirm({
        draft: { owner: { firstName: "Ravi" }, vehicle: {}, job: {} },
        serviceCenterId: String(center._id),
        createdByAccountId: String(new mongoose.Types.ObjectId()),
      }),
    ).rejects.toThrow();
    expect(await OwnerProfile.countDocuments()).toBe(0);
    expect(await Vehicle.countDocuments()).toBe(0);
  });

  it("creates owner, vehicle and job card for a new walk-in customer", async () => {
    const center = await makeCenter();
    const staffAccountId = String(new mongoose.Types.ObjectId());

    const res = await voiceIntakeService.confirm({
      draft: FULL,
      serviceCenterId: String(center._id),
      createdByAccountId: staffAccountId,
    });

    expect(res.createdOwner).toBe(true);
    expect(res.createdVehicle).toBe(true);
    expect(await Account.countDocuments({ primaryRole: "owner" })).toBe(1);
    const record = await ServiceRecord.findById(res.serviceRecord._id);
    expect(record?.description).toBe("Oil change and general checkup");
    expect(record?.odometerReading.value).toBe(45000);
    expect(String(record?.ownerId)).toBe(String(res.owner._id));
  });

  it("reuses the vehicle and owner when the registration already exists", async () => {
    const center = await makeCenter();
    const args = { draft: FULL, serviceCenterId: String(center._id), createdByAccountId: String(new mongoose.Types.ObjectId()) };

    await voiceIntakeService.confirm(args);
    const second = await voiceIntakeService.confirm(args);

    expect(second.createdOwner).toBe(false);
    expect(second.createdVehicle).toBe(false);
    expect(await Vehicle.countDocuments()).toBe(1);
    expect(await OwnerProfile.countDocuments()).toBe(1);
    expect(await ServiceRecord.countDocuments()).toBe(2);
  });
});
