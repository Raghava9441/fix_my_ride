// src/services/ownerStats.ts
import mongoose from "mongoose";
import { OwnerProfile } from "../models/OwnerProfile";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { logger } from "../config/logger";

/**
 * Recomputes the denormalised counters on an owner profile.
 *
 * ---- Why these counters exist at all ----
 *
 * `OwnerProfile.stats` is the only way a *list* of customers can show vehicle
 * counts and lifetime spend. The alternative is three queries per row, which
 * is an N+1 across a page of twenty. So the counters are written on every
 * mutation that can change them, and read freely.
 *
 * ---- Why this lives in its own module ----
 *
 * Both `vehicle.service` and `serviceRecord.service` have to call it, and
 * both are imported by `owner.service`. Reaching for `ownerService` from
 * them would close an import cycle; depending on the models directly does
 * not.
 *
 * ---- The source of truth ----
 *
 * Vehicles are counted from `Vehicle.currentOwnerId`, not from the embedded
 * `OwnerProfile.vehicles[]` array. The array is a second denormalisation
 * that only `ownerService.addVehicle` maintains — `vehicleService.create`
 * sets `currentOwnerId` and never touches it — so the two disagree for every
 * vehicle created through the normal path. `currentOwnerId` is the edge the
 * rest of the system actually joins on.
 */
export async function recomputeOwnerStats(ownerId: string | mongoose.Types.ObjectId): Promise<void> {
  const id = typeof ownerId === "string" ? new mongoose.Types.ObjectId(ownerId) : ownerId;

  const [totalVehicles, totalServices, spend] = await Promise.all([
    Vehicle.countDocuments({ currentOwnerId: id, isDeleted: false }),
    ServiceRecord.countDocuments({ ownerId: id, isDeleted: false }),
    ServiceRecord.aggregate([
      { $match: { ownerId: id, isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$cost.total" } } },
    ]),
  ]);

  // `updateOne` with `$set` rather than load-mutate-save: this runs after
  // another write has already committed, and re-saving the whole document
  // would clobber any field changed in between by a concurrent request.
  await OwnerProfile.updateOne(
    { _id: id },
    {
      $set: {
        "stats.totalVehicles": totalVehicles,
        "stats.totalServices": totalServices,
        "stats.totalSpent": spend[0]?.total || 0,
      },
    },
  );
}

/**
 * Recomputes in the background of a request that has already succeeded.
 *
 * Every caller is a mutation that has *already committed* — the service
 * record was created, the vehicle was transferred. Letting a counter refresh
 * throw at that point would answer a successful write with an error, and the
 * client's reasonable response to an error is to retry, which on a create
 * means a duplicate record. A stale counter is a far cheaper wrong than that,
 * and the next mutation corrects it.
 *
 * Awaited rather than fired and forgotten, so a caller that reads the owner
 * back in the same flow sees the new numbers. The cost is two counts and a
 * small aggregate, all on indexed fields.
 */
export async function refreshOwnerStats(
  ownerId: string | mongoose.Types.ObjectId | null | undefined,
  context: string,
): Promise<void> {
  if (!ownerId) return;

  try {
    await recomputeOwnerStats(ownerId);
  } catch (error) {
    logger.warn(
      `Failed to refresh owner stats after ${context} for owner ${String(ownerId)}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
