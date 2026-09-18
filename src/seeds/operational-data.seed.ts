// seeds/operational-data.seed.ts
import mongoose from "mongoose";
import { Account } from "../models/Account";
import { OwnerProfile } from "../models/OwnerProfile";
import { StaffProfile } from "../models/StaffProfile";
import { ServiceCenter } from "../models/ServiceCenter";
import { Vehicle } from "../models/Vehicle";
import { ServiceRecord } from "../models/ServiceRecord";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { Subscription } from "../models/Subscription";
import { Invoice } from "../models/Invoice";
import { Payment } from "../models/Payment";
import { Reminder } from "../models/Reminder";
import { Notification } from "../models/Notification";
import { Document } from "../models/Document";
import { Invitation } from "../models/Invitation";
import { Review } from "../models/Review";
import { AuditLog } from "../models/AuditLog";

const days = (n: number) => n * 24 * 60 * 60 * 1000;
const ago = (n: number) => new Date(Date.now() - days(n));
const ahead = (n: number) => new Date(Date.now() + days(n));

/**
 * Seeds the operational collections the earlier seeds don't touch —
 * subscriptions, billing, reminders, notifications, documents, invitations,
 * reviews and audit history — so a frontend has realistic data on every
 * screen rather than only vehicles and service records.
 *
 * Runs after sample-data.seed.ts and depends on what it creates (owner,
 * technician, vehicles, service records). Idempotent: each block is guarded
 * by a count check, so re-running tops nothing up twice.
 */
export const seedOperationalData = async (
  tenantId: mongoose.Types.ObjectId,
): Promise<void> => {
  const shouldSeed = process.env.SEED_SAMPLE_DATA === "true";
  if (!shouldSeed) {
    console.log("  ℹ️  SEED_SAMPLE_DATA not enabled, skipping operational data");
    return;
  }

  try {
    console.log("  📊 Seeding operational data...");

    // ─── Resolve everything the earlier seeds created ──────────────────────

    const serviceCenter = await ServiceCenter.findOne({ tenantId, isDeleted: false });
    const ownerAccount = await Account.findOne({ email: "owner@example.com", tenantId, isDeleted: false });
    const adminAccount = await Account.findOne({
      email: (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase(),
      isDeleted: false,
    });
    const staffAccount = await Account.findOne({ email: "technician@example.com", tenantId, isDeleted: false });

    if (!serviceCenter || !ownerAccount || !adminAccount) {
      console.log("  ⚠️  Core sample data missing (service center / owner / admin), skipping operational data");
      return;
    }

    const ownerProfile = await OwnerProfile.findOne({ accountId: ownerAccount._id });
    const staffProfile = staffAccount
      ? await StaffProfile.findOne({ accountId: staffAccount._id })
      : null;

    if (!ownerProfile) {
      console.log("  ⚠️  Owner profile missing, skipping operational data");
      return;
    }

    const vehicles = await Vehicle.find({ tenantId, currentOwnerId: ownerProfile._id, isDeleted: false });
    const serviceRecords = await ServiceRecord.find({ tenantId, isDeleted: false });

    if (vehicles.length === 0) {
      console.log("  ⚠️  No sample vehicles found, skipping operational data");
      return;
    }

    // ─── Vehicle warranty + insurance ──────────────────────────────────────
    // These fields exist on the schema but nothing seeded them, so the
    // frontend's warranty/insurance screens had nothing to render.

    let warrantyCount = 0;
    for (const [index, vehicle] of vehicles.entries()) {
      if (vehicle.warranty?.provider) continue;

      vehicle.set("warranty", {
        provider: `${vehicle.make} Care`,
        policyNumber: `WTY-${vehicle.registrationNumber}`,
        startDate: ago(365),
        expiryDate: ahead(365 - index * 60),
        coverageOdometer: 100000,
        coverageType: index === 0 ? "comprehensive" : "powertrain",
        notes: "Manufacturer warranty transferred with the vehicle.",
      });
      vehicle.set("insurance", {
        provider: ["Acko", "ICICI Lombard", "Bajaj Allianz"][index % 3],
        policyNumber: `INS-${vehicle.registrationNumber}`,
        startDate: ago(180),
        // Stagger expiries so "expiring soon" filters have something to show.
        expiryDate: ahead(index === 0 ? 20 : 185 + index * 30),
        premium: 12500 + index * 2500,
        coverageType: index === 1 ? "third_party" : "comprehensive",
        notes: "Renewal reminder configured.",
      });
      await vehicle.save();
      warrantyCount++;
    }
    if (warrantyCount) console.log(`    Added warranty + insurance to ${warrantyCount} vehicles`);

    // ─── Itemised labour + feedback on service records ─────────────────────

    let enrichedRecords = 0;
    for (const [index, record] of serviceRecords.entries()) {
      if (record.laborItems && record.laborItems.length > 0) continue;

      const laborItems = [
        { description: "Diagnostics", hours: 1, rate: 60, total: 60 },
        { description: "General service labour", hours: 2, rate: 20, total: 40 },
      ];
      const laborTotal = laborItems.reduce((sum, item) => sum + item.total, 0);

      record.set("laborItems", laborItems);
      record.set("feedback", {
        rating: [5, 4, 5][index % 3],
        comment: [
          "Great service, car runs smoothly now.",
          "Good work but pickup took a while.",
          "Very thorough inspection, will return.",
        ][index % 3],
        submittedBy: ownerAccount._id,
        submittedAt: ago(20 - index),
      });

      // Keep cost.laborTotal consistent with the lines it is summed from,
      // the same invariant the /labor endpoint maintains at runtime.
      const partsTotal = record.cost?.partsTotal ?? 0;
      const tax = record.cost?.tax ?? 0;
      const discount = record.cost?.discount ?? 0;
      record.set("cost.laborTotal", laborTotal);
      record.set("cost.subtotal", partsTotal + laborTotal);
      record.set("cost.total", partsTotal + laborTotal + tax - discount);

      await record.save();
      enrichedRecords++;
    }
    if (enrichedRecords) console.log(`    Added labour lines + feedback to ${enrichedRecords} service records`);

    // ─── Subscription ──────────────────────────────────────────────────────

    if ((await Subscription.countDocuments({ tenantId })) === 0) {
      const plan =
        (await SubscriptionPlan.findOne({ slug: "professional" })) ??
        (await SubscriptionPlan.findOne({}));

      if (plan) {
        await Subscription.create({
          tenantId,
          serviceCenterId: serviceCenter._id,
          planId: plan._id,
          status: "active",
          billingInterval: "month",
          currentPeriodStart: ago(10),
          currentPeriodEnd: ahead(20),
          provider: "manual",
        });
        console.log(`    Created subscription on plan: ${plan.name}`);
      }
    }

    // ─── Invoices + payments ───────────────────────────────────────────────
    // Three states so the billing screens have paid / partly paid / overdue
    // rows to render, rather than a single happy-path invoice.

    let invoiceCount = 0;
    if ((await Invoice.countDocuments({ tenantId })) === 0) {
      const states: Array<{
        status: string;
        paidFraction: number;
        dueDate: Date;
        record?: (typeof serviceRecords)[number];
      }> = [
        { status: "paid", paidFraction: 1, dueDate: ago(5), record: serviceRecords[0] },
        { status: "partially_paid", paidFraction: 0.4, dueDate: ahead(10), record: serviceRecords[1] },
        { status: "overdue", paidFraction: 0, dueDate: ago(12), record: serviceRecords[2] },
      ];

      for (const state of states) {
        const record = state.record;
        const subtotal = record?.cost?.subtotal ?? 2000;
        const taxAmount = record?.cost?.tax ?? 100;
        const discountAmount = record?.cost?.discount ?? 0;
        const totalAmount = subtotal + taxAmount - discountAmount;
        const amountPaid = Math.round(totalAmount * state.paidFraction);

        const invoice = await Invoice.create({
          tenantId,
          invoiceNumber: await Invoice.generateInvoiceNumber(),
          accountId: ownerAccount._id,
          serviceCenterId: serviceCenter._id,
          serviceRecordIds: record ? [record._id] : [],
          lineItems: [
            { description: "Parts", quantity: 1, unitPrice: record?.cost?.partsTotal ?? 1250, total: record?.cost?.partsTotal ?? 1250 },
            { description: "Labour", quantity: 1, unitPrice: record?.cost?.laborTotal ?? 750, total: record?.cost?.laborTotal ?? 750 },
          ],
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          amountPaid,
          amountDue: totalAmount - amountPaid,
          currency: "USD",
          status: state.status,
          issueDate: ago(20),
          dueDate: state.dueDate,
          paidAt: state.paidFraction === 1 ? ago(4) : undefined,
          billingName: `${ownerProfile.firstName} ${ownerProfile.lastName}`,
          billingEmail: ownerAccount.email,
          isDeleted: false,
        });
        invoiceCount++;

        if (amountPaid > 0) {
          await Payment.create({
            tenantId,
            accountId: ownerAccount._id,
            type: "invoice",
            status: state.paidFraction === 1 ? "completed" : "pending",
            amount: amountPaid,
            currency: "USD",
            totalAmount: amountPaid,
            provider: "razorpay",
            providerPaymentId: `pay_seed_${invoice.invoiceNumber}`,
            invoiceId: invoice._id,
            serviceRecordIds: record ? [record._id] : [],
            description: `Payment for ${invoice.invoiceNumber}`,
            billingEmail: ownerAccount.email,
            billingName: `${ownerProfile.firstName} ${ownerProfile.lastName}`,
          });
        }
      }
      console.log(`    Created ${invoiceCount} invoices (paid / partially paid / overdue) with payments`);
    }

    // ─── Reminders ─────────────────────────────────────────────────────────

    if ((await Reminder.countDocuments({ tenantId })) === 0) {
      const reminders = vehicles.flatMap((vehicle, index) => [
        {
          tenantId,
          vehicleId: vehicle._id,
          ownerId: ownerProfile._id,
          type: "service",
          title: `Service due for ${vehicle.registrationNumber}`,
          description: "Routine maintenance is approaching its due date.",
          dueDate: ahead(7 + index * 14),
          priority: index === 0 ? "high" : "medium",
          status: "pending",
        },
        {
          tenantId,
          vehicleId: vehicle._id,
          ownerId: ownerProfile._id,
          type: "insurance",
          title: `Insurance renewal for ${vehicle.registrationNumber}`,
          description: "Policy expires soon — renew to stay covered.",
          // One deliberately overdue so the overdue list isn't empty.
          dueDate: index === 0 ? ago(3) : ahead(120 + index * 30),
          priority: index === 0 ? "urgent" : "low",
          status: "pending",
        },
      ]);

      await Reminder.insertMany(reminders);
      console.log(`    Created ${reminders.length} reminders (incl. one overdue)`);
    }

    // ─── Notifications ─────────────────────────────────────────────────────

    if ((await Notification.countDocuments({ tenantId })) === 0) {
      const notifications = [
        { type: "service_completed", title: "Service completed", content: "Your Toyota Camry service is complete and ready for pickup.", status: "read", channel: "in_app" },
        { type: "invoice_generated", title: "New invoice", content: "Invoice for your recent service is now available.", status: "delivered", channel: "email" },
        { type: "payment_received", title: "Payment received", content: "We've received your payment. Thank you!", status: "read", channel: "email" },
        { type: "service_reminder", title: "Service due soon", content: "Your Honda Civic is due for service in 7 days.", status: "sent", channel: "in_app" },
        { type: "subscription_expiring", title: "Subscription expiring", content: "Your plan renews in 20 days.", status: "pending", channel: "email" },
      ];

      await Notification.insertMany(
        notifications.map((n, index) => ({
          tenantId,
          recipientId: ownerAccount._id,
          recipientModel: "Account",
          title: n.title,
          content: n.content,
          channel: n.channel,
          type: n.type,
          status: n.status,
          priority: index === 0 ? "high" : "medium",
          readAt: n.status === "read" ? ago(index + 1) : undefined,
        })),
      );
      console.log(`    Created ${notifications.length} notifications (mixed read/unread)`);
    }

    // ─── Documents ─────────────────────────────────────────────────────────
    // Metadata only — these point at placeholder URLs rather than real files,
    // which is enough for list/detail screens. Downloading one will 404.

    if ((await Document.countDocuments({ tenantId })) === 0) {
      const docs = vehicles.map((vehicle, index) => ({
        tenantId,
        accountId: ownerAccount._id,
        originalName: `${vehicle.registrationNumber}-registration.pdf`,
        fileName: `seed-${vehicle.registrationNumber.toLowerCase()}-rc.pdf`,
        mimeType: "application/pdf",
        size: 182_400 + index * 1024,
        extension: ".pdf",
        storageProvider: "local",
        url: `/uploads/vehicle/seed-${vehicle.registrationNumber.toLowerCase()}-rc.pdf`,
        entityType: "vehicle",
        entityId: vehicle._id,
        documentType: "registration",
        description: "Vehicle registration certificate",
        tags: ["rc", "legal"],
        isPublic: false,
        status: "active",
        version: 1,
        isLatestVersion: true,
        isDeleted: false,
      }));

      docs.push({
        tenantId,
        accountId: ownerAccount._id,
        originalName: "workshop-license.pdf",
        fileName: "seed-workshop-license.pdf",
        mimeType: "application/pdf",
        size: 240_128,
        extension: ".pdf",
        storageProvider: "local",
        url: "/uploads/service_center/seed-workshop-license.pdf",
        entityType: "service_center",
        entityId: serviceCenter._id,
        documentType: "certificate",
        description: "Workshop operating licence",
        tags: ["licence"],
        isPublic: true,
        status: "active",
        version: 1,
        isLatestVersion: true,
        isDeleted: false,
      } as (typeof docs)[number]);

      await Document.insertMany(docs);
      console.log(`    Created ${docs.length} document records (metadata only, no real files)`);
    }

    // ─── Invitations ───────────────────────────────────────────────────────

    if ((await Invitation.countDocuments({ tenantId })) === 0) {
      await Invitation.insertMany([
        {
          tenantId,
          token: `seed-invite-staff-${Date.now()}`,
          inviteeEmail: "newtech@example.com",
          invitationType: "center_staff",
          role: "technician",
          serviceCenterId: serviceCenter._id,
          inviterId: adminAccount._id,
          inviterType: "Account",
          createdBy: adminAccount._id,
          status: "pending",
          message: "Join our workshop team on Fix My Ride.",
          maxUses: 1,
          expiresAt: ahead(14),
        },
        {
          tenantId,
          token: `seed-invite-access-${Date.now()}`,
          inviteeEmail: "spouse@example.com",
          invitationType: "vehicle_access",
          role: "viewer",
          vehicleId: vehicles[0]._id,
          inviterId: ownerAccount._id,
          inviterType: "Account",
          createdBy: ownerAccount._id,
          status: "pending",
          message: "Sharing access to our car's service history.",
          accessLevel: "readonly",
          maxUses: 1,
          expiresAt: ahead(7),
        },
      ]);
      console.log("    Created 2 invitations (staff join + vehicle access)");
    }

    // ─── Reviews ───────────────────────────────────────────────────────────

    if ((await Review.countDocuments({ serviceCenterId: serviceCenter._id })) === 0) {
      await Review.create({
        tenantId,
        serviceCenterId: serviceCenter._id,
        accountId: ownerAccount._id,
        serviceRecordId: serviceRecords[0]?._id,
        rating: 5,
        comment: "Honest pricing and the work was done ahead of schedule.",
      });

      // Keep the centre's cached rating consistent with the reviews just
      // written — the same derived-write the reviews endpoint performs.
      const summary = await Review.getRatingSummary(serviceCenter._id);
      await ServiceCenter.findByIdAndUpdate(serviceCenter._id, {
        $set: {
          "stats.averageRating": summary.averageRating,
          "stats.totalReviews": summary.totalReviews,
        },
      });
      console.log(`    Created 1 review and synced centre rating to ${summary.averageRating}`);
    }

    // ─── Audit log ─────────────────────────────────────────────────────────

    if ((await AuditLog.countDocuments({ tenantId })) === 0) {
      await AuditLog.insertMany([
        {
          tenantId,
          actorId: adminAccount._id,
          actorRole: "admin",
          actorEmail: adminAccount.email,
          action: "LOGIN",
          entityType: "Account",
          entityId: adminAccount._id,
          ipAddress: "127.0.0.1",
          userAgent: "seed-script",
          recordedAt: ago(2),
        },
        {
          tenantId,
          actorId: adminAccount._id,
          actorRole: "admin",
          actorEmail: adminAccount.email,
          action: "CREATE",
          entityType: "ServiceCenter",
          entityId: serviceCenter._id,
          ipAddress: "127.0.0.1",
          userAgent: "seed-script",
          recordedAt: ago(2),
        },
        {
          tenantId,
          actorId: staffAccount?._id ?? adminAccount._id,
          actorRole: staffAccount ? "staff" : "admin",
          actorEmail: (staffAccount ?? adminAccount).email,
          action: "UPDATE",
          entityType: "ServiceRecord",
          entityId: serviceRecords[0]?._id ?? serviceCenter._id,
          changes: [{ field: "status", oldValue: "in_progress", newValue: "completed" }],
          ipAddress: "127.0.0.1",
          userAgent: "seed-script",
          recordedAt: ago(1),
        },
        {
          tenantId,
          actorId: ownerAccount._id,
          actorRole: "owner",
          actorEmail: ownerAccount.email,
          action: "GRANT_ACCESS",
          entityType: "Vehicle",
          entityId: vehicles[0]._id,
          ipAddress: "127.0.0.1",
          userAgent: "seed-script",
          recordedAt: ago(1),
        },
      ]);
      console.log("    Created 4 audit log entries");
    }

    // ─── Staff profile for the technician, if sample-data couldn't make one ──
    if (staffAccount && !staffProfile) {
      console.log("    ⚠️  Technician account exists but has no StaffProfile (technician role missing at the time)");
    }

    console.log("  ✅ Operational data seeded successfully");
  } catch (error) {
    console.error("  ❌ Error seeding operational data:", error);
    throw error;
  }
};
