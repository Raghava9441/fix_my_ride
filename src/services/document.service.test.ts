import mongoose from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "../test-utils/db";
import { Document } from "../models/Document";
import { Vehicle } from "../models/Vehicle";
import { documentService } from "./document.service";
import {
  DOCUMENT_LINK_AUDIENCE,
  signDocumentLink,
  verifyDocumentLink,
} from "../utils/documentLink";
import { generateToken } from "../utils/token";

const oid = () => new mongoose.Types.ObjectId();
const day = 86_400_000;

function makeDoc(overrides: Record<string, unknown> = {}) {
  return documentService.create({
    originalName: "policy.pdf",
    fileName: `${Math.random().toString(36).slice(2)}.pdf`,
    mimeType: "application/pdf",
    size: 1000,
    extension: ".pdf",
    storageProvider: "local",
    url: "/uploads/vehicle/x.pdf",
    entityType: "vehicle",
    entityId: String(oid()),
    documentType: "insurance",
    ...overrides,
  } as any);
}

describe("documentService", () => {
  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  afterEach(async () => {
    await clearTestDb();
  });

  describe("findAll filters", () => {
    it("searches file name, description and tags, escaping regex characters", async () => {
      await makeDoc({ originalName: "rc-book.pdf" });
      await makeDoc({ originalName: "other.pdf", description: "Annual insurance policy" });
      await makeDoc({ originalName: "tagged.pdf", tags: ["fleet"] });
      await makeDoc({ originalName: "a.b" });
      await makeDoc({ originalName: "axb" });

      expect((await documentService.findAll({ q: "rc-book" })).data).toHaveLength(1);
      expect((await documentService.findAll({ q: "INSURANCE" })).data).toHaveLength(1);
      expect((await documentService.findAll({ q: "fleet" })).data).toHaveLength(1);
      // Unescaped, "a.b" would also match "axb".
      expect((await documentService.findAll({ q: "a.b" })).data).toHaveLength(1);
    });

    it("filters by verification and by expiry window", async () => {
      await makeDoc({ originalName: "expired.pdf", validUntil: new Date(Date.now() - 5 * day) });
      await makeDoc({ originalName: "soon.pdf", validUntil: new Date(Date.now() + 10 * day) });
      await makeDoc({ originalName: "later.pdf", validUntil: new Date(Date.now() + 200 * day) });
      await makeDoc({ originalName: "open-ended.pdf" });

      const expired = await documentService.findAll({ expiry: "expired" });
      expect(expired.data.map((d: any) => d.originalName)).toEqual(["expired.pdf"]);

      const soon = await documentService.findAll({ expiry: "expiring" });
      expect(soon.data.map((d: any) => d.originalName)).toEqual(["soon.pdf"]);

      const all = await documentService.findAll({});
      expect(all.data).toHaveLength(4);
      expect(all.data.find((d: any) => d.originalName === "expired.pdf").isExpired).toBe(true);
      expect(all.data.find((d: any) => d.originalName === "later.pdf").isExpired).toBe(false);
    });

    it("sorts only by allow-listed fields and caps the page size", async () => {
      await makeDoc({ originalName: "b.pdf", size: 1 });
      await makeDoc({ originalName: "a.pdf", size: 3 });

      const bySize = await documentService.findAll({ sort: "-size" });
      expect(bySize.data.map((d: any) => d.originalName)).toEqual(["a.pdf", "b.pdf"]);

      // An unknown field must not reach the query.
      await expect(documentService.findAll({ sort: "-passwordHash" })).resolves.toBeDefined();
      expect((await documentService.findAll({ limit: 100000 })).pagination.limit).toBe(100);
    });

    it("labels documents with the entity they are attached to", async () => {
      // Inserted raw: a full Vehicle has many required fields that are
      // irrelevant to what is being tested here.
      const vehicleId = oid();
      await Vehicle.collection.insertOne({
        _id: vehicleId,
        registrationNumber: "MH12AB1234",
        make: "Honda",
        model: "City",
      });
      await makeDoc({ entityId: String(vehicleId) });

      const { data } = await documentService.findAll({});
      expect(data[0].entityLabel).toBe("MH12AB1234 · Honda City");
    });
  });

  describe("getStats", () => {
    it("counts by type and flags unverified, expired and expiring documents", async () => {
      await makeDoc({ documentType: "insurance", size: 100, validUntil: new Date(Date.now() - day) });
      await makeDoc({ documentType: "insurance", size: 200, validUntil: new Date(Date.now() + 5 * day) });
      await makeDoc({ documentType: "puc", size: 300 });

      const stats = await documentService.getStats();
      expect(stats.total).toBe(3);
      expect(stats.totalBytes).toBe(600);
      expect(stats.unverified).toBe(3);
      expect(stats.expired).toBe(1);
      expect(stats.expiringSoon).toBe(1);
      expect(stats.byType).toEqual({ insurance: 2, puc: 1 });
    });

    it("ignores soft-deleted documents", async () => {
      const doc = await makeDoc();
      await documentService.softDelete(String(doc._id), String(oid()));
      expect((await documentService.getStats()).total).toBe(0);
    });
  });

  describe("validUntil", () => {
    it("is a plain index, so an expired document is kept rather than deleted", async () => {
      await Document.init();
      const indexes = await Document.collection.indexes();
      const index = indexes.find((i) => i.key?.validUntil === 1);
      expect(index).toBeDefined();
      expect(index?.expireAfterSeconds).toBeUndefined();
    });
  });

  describe("isAccessibleBy", () => {
    it("lets the uploader read their own file without an allow-list", async () => {
      const uploader = String(oid());
      const doc = await makeDoc({ accountId: uploader });
      expect(await documentService.isAccessibleBy(String(doc._id), uploader, "owner")).toBe(true);
      expect(await documentService.isAccessibleBy(String(doc._id), String(oid()), "owner")).toBe(false);
    });
  });
});

describe("document download links", () => {
  it("round-trips the document and tenant", () => {
    const { token, expiresAt } = signDocumentLink({ documentId: "doc1", tenantId: "ten1" });
    expect(verifyDocumentLink(token)).toEqual({ documentId: "doc1", tenantId: "ten1" });
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a token signed with another secret or for another audience", () => {
    const { token } = signDocumentLink({ documentId: "doc1" }, "some-other-secret-0000000000000000");
    expect(verifyDocumentLink(token)).toBeNull();

    // An ordinary access token must not be accepted as a download link.
    const accessToken = generateToken({ userId: "u1", documentId: "doc1" }, process.env.JWT_SECRET!);
    expect(verifyDocumentLink(accessToken)).toBeNull();
  });

  it("rejects an expired link and garbage", () => {
    const expired = generateToken({ documentId: "doc1" }, process.env.JWT_SECRET!, {
      expiresIn: -10,
      audience: DOCUMENT_LINK_AUDIENCE,
    });
    expect(verifyDocumentLink(expired)).toBeNull();
    expect(verifyDocumentLink("not-a-token")).toBeNull();
  });
});
