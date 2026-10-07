// src/services/invoicePdf.service.ts
import PDFDocument from "pdfkit";

const money = (amount: number | undefined, currency = "USD"): string =>
  `${currency} ${(amount ?? 0).toFixed(2)}`;

const dateOnly = (d?: Date | string): string =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

/**
 * Renders an invoice (as returned by invoiceService.findById, i.e. with
 * serviceCenterId populated) to an in-memory PDF. Pure rendering — no I/O —
 * so it can feed an HTTP download, storage upload and email attachment alike.
 */
export function renderInvoicePdf(invoice: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const currency: string = invoice.currency || "USD";
    const left = 50;
    const right = doc.page.width - 50;

    // Header
    doc.fontSize(22).font("Helvetica-Bold").text("INVOICE", left, 50);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, left, 50, { align: "right" });
    doc.text(`Status: ${String(invoice.status).toUpperCase()}`, { align: "right" });
    doc.text(`Issued: ${dateOnly(invoice.issueDate)}`, { align: "right" });
    doc.text(`Due: ${dateOnly(invoice.dueDate)}`, { align: "right" });

    // Parties
    doc.moveDown(2);
    const partiesY = doc.y;
    const centerName = invoice.serviceCenterId?.name;
    doc.font("Helvetica-Bold").text("From", left, partiesY);
    doc.font("Helvetica").text(centerName ?? "Fix My Ride");

    doc.font("Helvetica-Bold").text("Bill to", 320, partiesY);
    doc.font("Helvetica");
    if (invoice.billingName) doc.text(invoice.billingName, 320);
    if (invoice.billingEmail) doc.text(invoice.billingEmail, 320);
    const a = invoice.billingAddress;
    if (a) {
      const line = [a.street, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(", ");
      if (line) doc.text(line, 320, undefined, { width: right - 320 });
    }

    // Line items table
    doc.moveDown(2);
    let y = Math.max(doc.y, partiesY + 70);
    const cols = { desc: left, qty: 320, unit: 380, total: 470 };
    doc.font("Helvetica-Bold");
    doc.text("Description", cols.desc, y);
    doc.text("Qty", cols.qty, y, { width: 50, align: "right" });
    doc.text("Unit price", cols.unit, y, { width: 80, align: "right" });
    doc.text("Total", cols.total, y, { width: right - cols.total, align: "right" });
    y += 16;
    doc.moveTo(left, y).lineTo(right, y).stroke();
    y += 6;

    doc.font("Helvetica");
    for (const item of invoice.lineItems ?? []) {
      if (y > doc.page.height - 160) {
        doc.addPage();
        y = 50;
      }
      doc.text(item.description ?? "", cols.desc, y, { width: 260 });
      const rowEnd = doc.y;
      doc.text(String(item.quantity), cols.qty, y, { width: 50, align: "right" });
      doc.text(money(item.unitPrice, currency), cols.unit, y, { width: 80, align: "right" });
      doc.text(money(item.total, currency), cols.total, y, {
        width: right - cols.total,
        align: "right",
      });
      y = Math.max(rowEnd, y + 14) + 6;
    }

    // Totals
    doc.moveTo(left, y).lineTo(right, y).stroke();
    y += 10;
    const totals: Array<[string, number | undefined, boolean?]> = [
      ["Subtotal", invoice.subtotal],
      ["Tax", invoice.taxAmount],
      ["Discount", invoice.discountAmount],
      ["Total", invoice.totalAmount, true],
      ["Paid", invoice.amountPaid],
      ["Amount due", invoice.amountDue, true],
    ];
    for (const [label, value, bold] of totals) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica");
      doc.text(label, 320, y, { width: 100 });
      doc.text(money(value, currency), cols.total - 30, y, {
        width: right - cols.total + 30,
        align: "right",
      });
      y += 16;
    }

    if (invoice.notes) {
      doc.font("Helvetica-Bold").text("Notes", left, y + 10);
      doc.font("Helvetica").text(invoice.notes, left, undefined, { width: right - left });
    }

    doc.end();
  });
}
