// src/services/staffStats.ts
import mongoose from "mongoose";
import { StaffProfile } from "../models/StaffProfile";
import { ServiceRecord } from "../models/ServiceRecord";
import { logger } from "../config/logger";

/**
 * Recomputes the denormalised counters on a staff profile.
 *
 * ---- Recompute, not increment ----
 *
 * The previous `updateStats` took a delta and did `stats.x += delta`. A
 * counter maintained that way is only ever as correct as the last time
 * nothing went wrong: a retried request counts a job twice, a failed one
 * loses it, and a record edited from a different code path never reaches it.
 * There is no way to tell a drifted counter from a true one, and no way back
 * except a full recount — so this does the full recount every time. Two
 * aggregates over an indexed field are cheap, and the number is always
 * exactly what the source collection says.
 *
 * Mirrors `ownerStats.ts`, and lives in its own module for the same reason:
 * `serviceRecordService` has to call it without importing the staff service
 * and closing a cycle.
 */
export async function recomputeStaffStats(
  staffId: string | mongoose.Types.ObjectId,
): Promise<void> {
  const id = typeof staffId === "string" ? new mongoose.Types.ObjectId(staffId) : staffId;

  const [totals] = await ServiceRecord.aggregate([
    { $match: { technicianId: id, isDeleted: false } },
    {
      $group: {
        _id: null,
        totalServicesPerformed: { $sum: 1 },
        totalRevenueGenerated: { $sum: "$cost.total" },
        // Averaged only over jobs that were actually rated. `$avg` ignores
        // missing values, so an unrated job does not drag the score toward
        // zero — it simply isn't a data point.
        customerSatisfaction: { $avg: "$feedback.rating" },
      },
    },
  ]);

  await StaffProfile.updateOne(
    { _id: id },
    {
      $set: {
        "stats.totalServicesPerformed": totals?.totalServicesPerformed || 0,
        "stats.totalRevenueGenerated": totals?.totalRevenueGenerated || 0,
        "stats.customerSatisfaction": totals?.customerSatisfaction || 0,
      },
    },
  );
}

/**
 * Recomputes after a write that has already committed.
 *
 * Never throws: the job was created or deleted regardless, and answering a
 * successful write with an error invites a retry that duplicates it. A stale
 * counter is the cheaper wrong and the next mutation corrects it.
 */
export async function refreshStaffStats(
  staffId: string | mongoose.Types.ObjectId | null | undefined,
  context: string,
): Promise<void> {
  if (!staffId) return;

  try {
    await recomputeStaffStats(staffId);
  } catch (error) {
    logger.warn(
      `Failed to refresh staff stats after ${context} for staff ${String(staffId)}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
