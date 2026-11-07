import mongoose from "mongoose";
import { Account } from "../models/Account";
import { OwnerProfile } from "../models/OwnerProfile";
import { Vehicle } from "../models/Vehicle";
import { config } from "../config/environment";
import { logger } from "../config/logger";
import { normalizeWhatsAppNumber } from "../config/whatsapp";
import { AppError } from "../utils/appError";
import { ownerProfileService } from "./owner.service";
import { vehicleService } from "./vehicle.service";
import { serviceRecordService } from "./serviceRecord.service";
import { SERVICE_TYPES, VoiceDraft } from "../dto/voice-intake.dto";

type FieldKey =
  | "owner.firstName"
  | "owner.phone"
  | "vehicle.registrationNumber"
  | "vehicle.make"
  | "vehicle.model"
  | "vehicle.year"
  | "vehicle.fuelType"
  | "vehicle.odometer"
  | "job.description";

/** What must be known before a job card can be created, in the order we ask. */
const REQUIRED: Array<{ key: FieldKey; question: string }> = [
  { key: "owner.firstName", question: "What is the customer's name?" },
  { key: "owner.phone", question: "What is the customer's phone number?" },
  { key: "vehicle.registrationNumber", question: "What is the vehicle registration number?" },
  { key: "vehicle.make", question: "Which company makes the vehicle?" },
  { key: "vehicle.model", question: "What is the vehicle model?" },
  { key: "vehicle.year", question: "Which year is the vehicle?" },
  { key: "vehicle.fuelType", question: "Is it petrol, diesel, CNG, electric, hybrid or LPG?" },
  { key: "vehicle.odometer", question: "What is the odometer reading in kilometres?" },
  { key: "job.description", question: "What work needs to be done?" },
];

export interface ParseResult {
  draft: VoiceDraft;
  missing: Array<{ field: FieldKey; question: string }>;
  /** Next thing to ask out loud; null once everything is known. */
  nextQuestion: string | null;
  /** Read-back for the "is this correct?" step. */
  summary: string;
  readyToSubmit: boolean;
  /** "llm" when the local model answered, "rules" when it was unreachable. */
  extractor: "llm" | "rules";
}

const EMPTY_DRAFT = (): VoiceDraft => ({ owner: {}, vehicle: {}, job: {} });

const getPath = (draft: VoiceDraft, key: FieldKey): unknown => {
  const [section, field] = key.split(".") as ["owner" | "vehicle" | "job", string];
  return (draft[section] as Record<string, unknown>)[field];
};

/** Drops null/""/NaN so a model's "unknown" never overwrites a known value. */
function prune(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" && Number.isNaN(value)) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = prune(v);
      if (p !== undefined) out[k] = p;
    }
    return out;
  }
  return value;
}

/** New speech overrides the draft field-by-field; untouched fields survive. */
export function mergeDraft(base: VoiceDraft, patch: Partial<VoiceDraft>): VoiceDraft {
  return {
    owner: { ...base.owner, ...(prune(patch.owner) as object | undefined) },
    vehicle: { ...base.vehicle, ...(prune(patch.vehicle) as object | undefined) },
    job: { ...base.job, ...(prune(patch.job) as object | undefined) },
  };
}

const FUEL_TYPES = ["petrol", "diesel", "electric", "hybrid", "cng", "lpg"] as const;

/**
 * Field-by-field checks, so one bad value from the model (e.g. year
 * "twenty-ish") drops that field instead of the whole reply.
 */
export function sanitizeExtraction(raw: unknown): Partial<VoiceDraft> {
  const r = (prune(raw) ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : v;
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const year = (v: unknown) => {
    const n = num(v);
    return n !== undefined && Number.isInteger(n) && n >= 1900 && n <= new Date().getFullYear() + 1
      ? n
      : undefined;
  };
  const oneOf = <T extends string>(v: unknown, list: readonly T[]) => {
    const s = typeof v === "string" ? v.trim().toLowerCase() : "";
    return (list as readonly string[]).includes(s) ? (s as T) : undefined;
  };

  const o = r.owner ?? {};
  const v = r.vehicle ?? {};
  const j = r.job ?? {};
  const reg = str(v.registrationNumber)?.replace(/[\s-]+/g, "").toUpperCase();

  return prune({
    owner: { firstName: str(o.firstName), lastName: str(o.lastName), phone: str(o.phone) },
    vehicle: {
      registrationNumber: reg,
      make: str(v.make),
      model: str(v.model),
      year: year(v.year),
      fuelType: oneOf(v.fuelType, FUEL_TYPES),
      color: str(v.color),
      odometer: num(v.odometer),
    },
    job: {
      serviceType: oneOf(j.serviceType, SERVICE_TYPES),
      description: str(j.description),
      laborTotal: num(j.laborTotal),
      partsTotal: num(j.partsTotal),
    },
  }) as Partial<VoiceDraft>;
}

const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    owner: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        phone: { type: "string" },
      },
    },
    vehicle: {
      type: "object",
      properties: {
        registrationNumber: { type: "string" },
        make: { type: "string" },
        model: { type: "string" },
        year: { type: "integer" },
        fuelType: { type: "string", enum: [...FUEL_TYPES] },
        color: { type: "string" },
        odometer: { type: "number" },
      },
    },
    job: {
      type: "object",
      properties: {
        serviceType: { type: "string", enum: [...SERVICE_TYPES] },
        description: { type: "string" },
        laborTotal: { type: "number" },
        partsTotal: { type: "number" },
      },
    },
  },
};

const SYSTEM_PROMPT = `You extract vehicle-workshop intake data from a mechanic's spoken words (English, Hindi or Hinglish, possibly with speech-to-text mistakes).
Return ONLY JSON matching the schema. Rules:
- Include a field ONLY if it was actually said. Never guess or invent values.
- registrationNumber: uppercase, no spaces (e.g. "ka 01 ab 1234" -> "KA01AB1234").
- phone: digits only. odometer: kilometres as a number. year: 4 digits.
- description: short plain-English summary of the work requested.
- serviceType: oil_change, brake_service, tire_rotation, repair, maintenance, inspection or other.
- Costs only if an amount was stated.`;

async function extractWithLlm(transcript: string, draft: VoiceDraft): Promise<Partial<VoiceDraft>> {
  const res = await fetch(`${config.voice.llmBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(config.voice.llmTimeoutMs),
    body: JSON.stringify({
      model: config.voice.llmModel,
      stream: false,
      format: EXTRACTION_JSON_SCHEMA,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Already captured (do not repeat unless corrected): ${JSON.stringify(draft)}\n\nMechanic said: """${transcript}"""`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM responded ${res.status}`);
  const body = (await res.json()) as { message?: { content?: string } };
  return sanitizeExtraction(JSON.parse(body.message?.content ?? "{}"));
}

const FUEL_WORDS: Array<[RegExp, (typeof FUEL_TYPES)[number]]> = [
  [/\bpetrol\b/i, "petrol"],
  [/\bdiesel\b/i, "diesel"],
  [/\b(electric|ev)\b/i, "electric"],
  [/\bhybrid\b/i, "hybrid"],
  [/\bcng\b/i, "cng"],
  [/\blpg\b/i, "lpg"],
];

const SERVICE_WORDS: Array<[RegExp, (typeof SERVICE_TYPES)[number]]> = [
  [/oil\s*(change|service)/i, "oil_change"],
  [/brake/i, "brake_service"],
  [/tyre|tire|wheel/i, "tire_rotation"],
  [/inspect|checkup|check-up/i, "inspection"],
  [/repair|fix|problem|noise|leak|not starting/i, "repair"],
  [/service|maintenance/i, "maintenance"],
];

/**
 * Deterministic extractor for the highly patterned fields. Used alone when the
 * local model isn't running, and to fill gaps the model leaves otherwise.
 * Names/make/model need the LLM.
 */
export function extractWithRules(transcript: string): Partial<VoiceDraft> {
  const out = EMPTY_DRAFT();

  const plate = transcript.match(/\b([A-Za-z]{2})[\s-]?(\d{1,2})[\s-]?([A-Za-z]{1,3})[\s-]?(\d{4})\b/);
  if (plate) out.vehicle.registrationNumber = (plate[1] + plate[2] + plate[3] + plate[4]).toUpperCase();

  const phone = transcript
    .replace(/(?<=\d)[\s-]+(?=\d)/g, "")
    .match(/(?<!\d)(?:\+?91)?([6-9]\d{9})(?!\d)/);
  if (phone) out.owner.phone = phone[1];

  const km = transcript.match(/(\d[\d,]*)\s*(?:km|kms|kilomet(?:er|re)s?)\b/i);
  if (km) out.vehicle.odometer = Number(km[1].replace(/,/g, ""));

  const year = transcript.match(/\b(19[89]\d|20\d{2})\b/);
  if (year && Number(year[1]) <= new Date().getFullYear() + 1) out.vehicle.year = Number(year[1]);

  for (const [re, fuel] of FUEL_WORDS) {
    if (re.test(transcript)) {
      out.vehicle.fuelType = fuel;
      break;
    }
  }
  for (const [re, type] of SERVICE_WORDS) {
    if (re.test(transcript)) {
      out.job.serviceType = type;
      break;
    }
  }
  return out;
}

function summarize(draft: VoiceDraft): string {
  const { owner, vehicle, job } = draft;
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ") || "unknown customer";
  const car = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "unknown vehicle";
  const details = [
    vehicle.registrationNumber ? `registration ${vehicle.registrationNumber}` : "",
    vehicle.fuelType ?? "",
    vehicle.odometer !== undefined ? `${vehicle.odometer} km` : "",
  ].filter(Boolean);
  return [
    `Customer: ${name}${owner.phone ? `, phone ${owner.phone}` : ""}.`,
    `Vehicle: ${car}${details.length ? `, ${details.join(", ")}` : ""}.`,
    `Job: ${job.description ?? "not stated"}.`,
  ].join(" ");
}

export function evaluateDraft(draft: VoiceDraft) {
  const missing = REQUIRED.filter(({ key }) => getPath(draft, key) === undefined).map((m) => ({
    field: m.key,
    question: m.question,
  }));
  return {
    missing,
    nextQuestion: missing[0]?.question ?? null,
    readyToSubmit: missing.length === 0,
    summary: summarize(draft),
  };
}

export class VoiceIntakeService {
  async parse(transcript: string, existing?: VoiceDraft): Promise<ParseResult> {
    const base = existing ?? EMPTY_DRAFT();
    let extractor: ParseResult["extractor"] = "llm";
    let extracted: Partial<VoiceDraft>;

    try {
      extracted = await extractWithLlm(transcript, base);
    } catch (err) {
      extractor = "rules";
      logger.warn({
        type: "voice_intake_llm_unavailable",
        error: (err as Error).message,
        message: "Falling back to rule-based extraction",
      });
      extracted = {};
    }

    // Rules fill gaps (plate/phone/odometer); the model's answer wins on conflict.
    const withRules = mergeDraft(base, extractWithRules(transcript));
    const merged = mergeDraft(withRules, extracted);

    return { draft: merged, extractor, ...evaluateDraft(merged) };
  }

  /**
   * Creates owner (if new), vehicle (if new) and the job card. Called only
   * after the mechanic has heard the summary and said yes.
   */
  async confirm(params: {
    draft: VoiceDraft;
    serviceCenterId: string;
    tenantId?: string;
    createdByAccountId: string;
  }) {
    const { draft, serviceCenterId, tenantId, createdByAccountId } = params;
    const { missing } = evaluateDraft(draft);
    if (missing.length > 0) {
      throw AppError.fromCode("VALIDATION_FAILED", {
        details: missing.map((m) => ({ field: m.field, message: m.question })),
      });
    }

    const reg = draft.vehicle.registrationNumber!.replace(/\s+/g, "").toUpperCase();
    const odometer = draft.vehicle.odometer!;

    let vehicle: any = await Vehicle.findOne({ registrationNumber: reg, isDeleted: false });
    let owner: any = vehicle ? await OwnerProfile.findById(vehicle.currentOwnerId) : null;
    let createdOwner = false;

    if (!owner) {
      ({ owner, created: createdOwner } = await this.findOrCreateOwner(draft, tenantId));
    }

    const createdVehicle = !vehicle;
    if (!vehicle) {
      vehicle = await vehicleService.create({
        tenantId,
        registrationNumber: reg,
        make: draft.vehicle.make!,
        model: draft.vehicle.model!,
        year: draft.vehicle.year!,
        fuelType: draft.vehicle.fuelType!,
        color: draft.vehicle.color,
        currentOwnerId: String(owner._id),
        currentOdometer: { value: odometer, unit: "km" },
      });
    }

    const serviceRecord = await serviceRecordService.create({
      tenantId,
      vehicleId: String(vehicle._id),
      serviceCenterId,
      serviceType: draft.job.serviceType ?? "other",
      odometerReading: { value: odometer, unit: "km" },
      description: draft.job.description!,
      cost: { laborTotal: draft.job.laborTotal, partsTotal: draft.job.partsTotal },
      status: "scheduled",
      createdBy: { accountId: createdByAccountId, role: "staff" },
    });

    return { owner, vehicle, serviceRecord, createdOwner, createdVehicle };
  }

  /**
   * Walk-in customers have no login. They get a password-less Account (the
   * model requires a unique email, so a placeholder one derived from the
   * phone) that can't sign in, and can claim it later by registering.
   */
  private async findOrCreateOwner(draft: VoiceDraft, tenantId?: string) {
    const canonical = normalizeWhatsAppNumber(draft.owner.phone);
    if (!canonical) {
      throw AppError.fromCode("VALIDATION_FAILED", {
        details: [{ field: "owner.phone", message: "Phone number is not valid" }],
      });
    }

    const account =
      (await Account.findOne({
        phone: { $in: [draft.owner.phone, canonical, `+${canonical}`] },
        primaryRole: "owner",
      })) ??
      (await Account.create({
        email: `walkin-${canonical}@walkin.invalid`,
        phone: canonical,
        primaryRole: "owner",
        roles: ["owner"],
        tenantId: tenantId ? new mongoose.Types.ObjectId(tenantId) : undefined,
        status: "active",
        authProvider: "email",
      }));

    const existing = await OwnerProfile.findOne({ accountId: account._id, isDeleted: false });
    if (existing) return { owner: existing, created: false };

    const owner = await ownerProfileService.create({
      accountId: String(account._id),
      firstName: draft.owner.firstName!,
      lastName: draft.owner.lastName || "-",
    });
    await Account.updateOne({ _id: account._id }, { $set: { ownerProfileId: owner._id } });
    return { owner, created: true };
  }
}

export const voiceIntakeService = new VoiceIntakeService();
