import mongoose from "mongoose";
import { MongoMemoryServer, MongoMemoryReplSet } from "mongodb-memory-server";

let mongod: MongoMemoryServer | undefined;
let replSet: MongoMemoryReplSet | undefined;

export async function connectTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

/**
 * Single-node replica set — required for `mongoose.startSession()` +
 * transactions to work at all (a standalone mongod, what connectTestDb()
 * gives you, doesn't support them). Use this instead whenever the code
 * under test opens a session, e.g. onboarding.service.ts.
 */
export async function connectTestReplSetDb(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod?.stop({ doCleanup: true, force: true });
  mongod = undefined;
  await replSet?.stop({ doCleanup: true, force: true });
  replSet = undefined;
}

export async function clearTestDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}
