// src/scripts/backfill-owner-stats.ts
/**
 * Recomputes `OwnerProfile.stats` and `StaffProfile.stats` for everyone.
 *
 * Usage: npm run backfill:owner-stats [-- --dry-run]
 *
 * The counters are maintained going forward by the mutations that change
 * them (see `ownerStats.ts`), but nothing has recomputed the records that
 * already existed — they were written once at profile creation, as zeros,
 * and never touched again. This is the one-off that corrects them.
 *
 * Safe to run repeatedly: it derives every figure from the source
 * collections rather than adjusting what is already stored, so running it
 * twice gives the same answer as running it once.
 */

import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { OwnerProfile } from "../models/OwnerProfile";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { StaffProfile } from "../models/StaffProfile";
import { recomputeOwnerStats } from "../services/ownerStats";
import { recomputeStaffStats } from "../services/staffStats";

interface Counts {
  totalVehicles: number;
  totalServices: number;
  totalSpent: number;
}

async function currentCounts(ownerId: mongoose.Types.ObjectId): Promise<Counts> {
  const [totalVehicles, totalServices, spend] = await Promise.all([
    Vehicle.countDocuments({ currentOwnerId: ownerId, isDeleted: false }),
    ServiceRecord.countDocuments({ ownerId, isDeleted: false }),
    ServiceRecord.aggregate([
      { $match: { ownerId, isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$cost.total" } } },
    ]),
  ]);

  return { totalVehicles, totalServices, totalSpent: spend[0]?.total || 0 };
}

const main = async () => {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  console.log("\n📊 Fix My Ride - Owner stats backfill\n");
  if (dryRun) console.log("   DRY RUN - nothing will be written\n");

  await connectDatabase();

  // Includes soft-deleted profiles: their stats are still read if the record
  // is ever restored, and leaving them stale just defers the problem.
  const owners = await OwnerProfile.find({}, { _id: 1, firstName: 1, lastName: 1, stats: 1 });
  console.log(`   ${owners.length} owner profile(s) found\n`);

  let changed = 0;

  for (const owner of owners) {
    const next = await currentCounts(owner._id as mongoose.Types.ObjectId);
    const prev = {
      totalVehicles: owner.stats?.totalVehicles ?? 0,
      totalServices: owner.stats?.totalServices ?? 0,
      totalSpent: owner.stats?.totalSpent ?? 0,
    };

    const differs =
      prev.totalVehicles !== next.totalVehicles ||
      prev.totalServices !== next.totalServices ||
      prev.totalSpent !== next.totalSpent;

    if (!differs) continue;

    changed++;
    const name = `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || String(owner._id);
    console.log(
      `   ${name}: ` +
        `vehicles ${prev.totalVehicles}→${next.totalVehicles}, ` +
        `services ${prev.totalServices}→${next.totalServices}, ` +
        `spent ${prev.totalSpent}→${next.totalSpent}`,
    );

    if (!dryRun) await recomputeOwnerStats(owner._id as mongoose.Types.ObjectId);
  }

  console.log(
    `\n   ${changed} customer profile(s) ${dryRun ? "would be" : "were"} corrected, ` +
      `${owners.length - changed} already accurate.\n`,
  );

  /* ---------------- staff ---------------- */

  const staff = await StaffProfile.find({}, { _id: 1, employeeId: 1, stats: 1 });
  console.log(`   ${staff.length} staff profile(s) found\n`);

  let staffChanged = 0;

  for (const member of staff) {
    const id = member._id as mongoose.Types.ObjectId;

    const [totals] = await ServiceRecord.aggregate([
      { $match: { technicianId: id, isDeleted: false } },
      {
        $group: {
          _id: null,
          totalServicesPerformed: { $sum: 1 },
          totalRevenueGenerated: { $sum: "$cost.total" },
        },
      },
    ]);

    const next = {
      jobs: totals?.totalServicesPerformed || 0,
      revenue: totals?.totalRevenueGenerated || 0,
    };
    const prev = {
      jobs: member.stats?.totalServicesPerformed ?? 0,
      revenue: member.stats?.totalRevenueGenerated ?? 0,
    };

    if (prev.jobs === next.jobs && prev.revenue === next.revenue) continue;

    staffChanged++;
    console.log(
      `   ${member.employeeId || String(member._id)}: ` +
        `jobs ${prev.jobs}→${next.jobs}, revenue ${prev.revenue}→${next.revenue}`,
    );

    if (!dryRun) await recomputeStaffStats(id);
  }

  console.log(
    `\n   ${staffChanged} staff profile(s) ${dryRun ? "would be" : "were"} corrected, ` +
      `${staff.length - staffChanged} already accurate.\n`,
  );

  await disconnectDatabase();
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Backfill failed:", error);
    process.exit(1);
  });
