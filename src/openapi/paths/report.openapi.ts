import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, commonErrorResponses, BEARER_AUTH } from "../common";
import { ExportReportSchema } from "../../dto/report.dto";

const TAGS = ["Reports"];
const record = z.record(z.any());
const base = "/api/v1/reports";

const dateRangeQuery = z.object({ startDate: z.string().datetime().optional(), endDate: z.string().datetime().optional() });
const centerQuery = z.object({ serviceCenterId: z.string().optional().openapi({ description: "Defaults to the authenticated staff member's own center if omitted" }) });
const ownerQuery = z.object({ ownerId: z.string().optional().openapi({ description: "Defaults to the authenticated owner's own profile if omitted" }) });

function centerReport(path: string, summary: string, extraQuery: z.ZodRawShape = {}) {
  registry.registerPath({
    method: "get", path: `${base}${path}`, tags: TAGS, summary, security: BEARER_AUTH,
    request: { query: centerQuery.merge(dateRangeQuery).extend(extraQuery) },
    responses: {
      200: { description: summary, content: { "application/json": { schema: successEnvelope("ReportResponse", record) } } },
      400: { description: "serviceCenterId is required and could not be resolved" },
      ...commonErrorResponses(),
    },
  });
}

function ownerReport(path: string, summary: string) {
  registry.registerPath({
    method: "get", path: `${base}${path}`, tags: TAGS, summary, security: BEARER_AUTH,
    request: { query: ownerQuery },
    responses: {
      200: { description: summary, content: { "application/json": { schema: successEnvelope("ReportResponse", record) } } },
      400: { description: "ownerId is required and could not be resolved" },
      ...commonErrorResponses(),
    },
  });
}

function adminReport(path: string, summary: string) {
  registry.registerPath({
    method: "get", path: `${base}${path}`, tags: TAGS, summary: summary + " (platform-wide)", security: BEARER_AUTH,
    request: { query: dateRangeQuery },
    responses: { 200: { description: summary, content: { "application/json": { schema: successEnvelope("ReportResponse", record) } } }, ...commonErrorResponses() },
  });
}

centerReport("/dashboard", "Service center dashboard totals (revenue, vehicles, service records, active customers)");
centerReport("/service-center/revenue", "Daily revenue breakdown for a service center");
centerReport("/service-center/vehicles", "Vehicle authorization counts for a service center");
centerReport("/service-center/services", "Service-type breakdown for a service center");
centerReport("/service-center/staff-performance", "Per-staff performance stats for a service center");
centerReport("/service-center/customer-satisfaction", "Average rating and review count for a service center");
centerReport("/service-center/parts-usage", "Parts usage and cost breakdown for a service center");

ownerReport("/owner/expenses", "An owner's total spend, broken down by service type");
ownerReport("/owner/service-history", "An owner's full service history");
ownerReport("/owner/upcoming-services", "An owner's upcoming reminders/services (next 90 days)");
ownerReport("/owner/maintenance-summary", "An owner's scheduled/completed/missed service counts");

adminReport("/admin/tenants", "Tenant counts (total/active/inactive)");
adminReport("/admin/revenue", "SaaS revenue (total, this period, ARPU)");
adminReport("/admin/growth", "New vs. cancelled tenant growth metrics");
adminReport("/admin/retention", "Tenant retention rate and average revenue per tenant");
adminReport("/admin/churn", "Tenant churn count and rate");

registry.registerPath({
  method: "post",
  path: `${base}/export`,
  tags: TAGS,
  summary: "Export a report as CSV (PDF/Excel not implemented — no generation library in this codebase)",
  security: BEARER_AUTH,
  request: { body: { content: { "application/json": { schema: ExportReportSchema } } } },
  responses: {
    200: { description: "CSV file", content: { "text/csv": { schema: { type: "string" } } } },
    400: { description: "Unknown report type, or missing serviceCenterId/ownerId" },
    501: { description: "format was pdf/excel — not implemented" },
    ...commonErrorResponses({ validate: true }),
  },
});
