// src/scripts/drop-document-ttl-index.ts
/**
 * One-off: drops the legacy TTL index on `documents.validUntil`.
 *
 * Usage: npm run migrate:drop-document-ttl
 *
 * The old schema declared `{ validUntil: 1 }` with `expireAfterSeconds: 0`,
 * which made MongoDB hard-delete every document at its expiry date. The model
 * now declares a plain index on the same key; MongoDB refuses to build it
 * while the TTL one exists (IndexOptionsConflict), so the old one must go
 * first. Safe to run repeatedly.
 */

import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { logger } from "../config/logger";

async function main() {
  await connectDatabase();

  const collection = mongoose.connection.collection("documents");
  const indexes = await collection.indexes();
  const ttl = indexes.find((i) => i.key?.validUntil === 1 && i.expireAfterSeconds !== undefined);

  if (!ttl?.name) {
    logger.info("No TTL index on documents.validUntil - nothing to do");
  } else {
    await collection.dropIndex(ttl.name);
    logger.info(`Dropped TTL index ${ttl.name} on documents.validUntil`);
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  logger.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
