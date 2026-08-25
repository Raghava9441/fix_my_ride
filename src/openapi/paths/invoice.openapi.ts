import { z } from "zod";
import { registry } from "../registry";
import { successEnvelope, paginatedEnvelope, commonErrorResponses, BEARER_AUTH, IdParamSchema, PaginationQuerySchema } from "../common";
import { CreateInvoiceSchema, VoidInvoiceSchema } from "../../dto/invoice.dto";

const TAGS = ["Invoices"];
const record = z.record(z.any());
const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ body: { content: { "application/json": { schema } } } });
const base = "/api/v1/invoices";

registry.registerPath({
  method: "get", path: base, tags: TAGS, summary: "List invoices (own invoices, or all as admin)", security: BEARER_AUTH,
  request: { query: PaginationQuerySchema.extend({ accountId: z.string().optional(), serviceCenterId: z.string().optional(), tenantId: z.string().optional(), status: z.string().optional() }) },
  responses: { 200: { description: "Invoices", content: { "application/json": { schema: paginatedEnvelope("InvoiceListResponse", record) } } }, ...commonErrorResponses() },
});

registry.registerPath({
  method: "get", path: `${base}/{id}`, tags: TAGS, summary: "Get an invoice by id", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: {
    200: { description: "Invoice", content: { "application/json": { schema: successEnvelope("InvoiceResponse", record) } } },
    403: { description: "Not your invoice" },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "post", path: base, tags: TAGS, summary: "Create an invoice for a customer (staff/admin only)", security: BEARER_AUTH, request: jsonBody(CreateInvoiceSchema),
  responses: { 201: { description: "Invoice created", content: { "application/json": { schema: successEnvelope("InvoiceResponse", record) } } }, ...commonErrorResponses({ validate: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/pay`, tags: TAGS, summary: "Create a Razorpay Order for the invoice's outstanding balance", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: {
    200: {
      description:
        "Order created. The customer completes payment against orderId via Razorpay Checkout; the invoice is marked paid once billing.service.ts processes the resulting payment.captured webhook.",
      content: { "application/json": { schema: successEnvelope("InvoicePaymentOrderResponse", z.object({ invoice: record, orderId: z.string() })) } },
    },
    400: { description: "No amount due, payment provider not configured, or no billing email on file" },
    403: { description: "Not your invoice" },
    ...commonErrorResponses({ notFound: true }),
  },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/send`, tags: TAGS, summary: "Mark an invoice as sent (staff/admin only)", security: BEARER_AUTH, request: { params: IdParamSchema },
  responses: { 200: { description: "Invoice marked as sent", content: { "application/json": { schema: successEnvelope("InvoiceResponse", record) } } }, ...commonErrorResponses({ notFound: true }) },
});

registry.registerPath({
  method: "post", path: `${base}/{id}/void`, tags: TAGS, summary: "Void an invoice (staff/admin only)", security: BEARER_AUTH, request: { params: IdParamSchema, ...jsonBody(VoidInvoiceSchema) },
  responses: { 200: { description: "Invoice voided", content: { "application/json": { schema: successEnvelope("InvoiceResponse", record) } } }, ...commonErrorResponses({ notFound: true, validate: true }) },
});
