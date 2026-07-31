# Background Jobs / Queue

This is a **hand-rolled Redis-backed job queue** — not Bull/BullMQ/Agenda, despite `ioredis` being the only queue-adjacent dependency installed. Don't reach for Bull-specific docs/APIs when working in this area.

## The pieces

- **`config/queue.ts`** — the low-level primitive. Jobs are stored as a Redis hash per job (`queue:<name>:jobs:<id>`), with waiting/active/completed/failed sets tracked via sorted sets (`zadd`/`zrange`). `addJob(queueName, job)` JSON-stringifies `job.data` before storing (Redis hashes are string-only) and `getJob` parses it back. `createQueue`, `getWaitingJobs`/`getActiveJobs`, `moveJobToActive`/`moveJobToCompleted`/`moveJobToFailed`, `updateJobProgress` round out the primitive operations.
- **`services/queue.service.ts`** — the worker runtime on top of that primitive: `startWorker(queueName, options)` spins up a polling loop (`pollIntervalMs`, `concurrency`, `maxAttempts`, `backoffMs`), `registerHandler(queueName, jobType, handler)` maps a job `type` string to an async handler function, `stopAllWorkers()` for graceful shutdown.
- **`workers/index.ts`** — the actual bootstrap. `startWorkers()` (called once from `server.ts` after Redis connects) starts a single queue, `"emails"`, and registers every handler exported from `jobs/email.job.ts` (`emailHandlers`, an object of `type -> handler`). `stopWorkers()` is called during graceful shutdown.

## Enqueueing a job

```ts
import { addJob } from "../config/queue";

await addJob("emails", { type: "welcome_email", data: { accountId, email } });
```

The `type` must match a key in whatever handlers object the target queue registered (`emailHandlers` for the `"emails"` queue).

## What's *not* wired up

Only the `"emails"` queue + `jobs/email.job.ts` are live. The rest of `src/jobs/` — `cleanup.job.ts`, `invoice.job.ts`, `notification.job.ts`, `reminder.job.ts`, `report.job.ts` — exist as handler modules but **no queue is created for them and `workers/index.ts` never registers them**. Similarly, `src/events/` (emitters + handlers) and `src/subscribers/` (an event-driven audit/notification dispatch pattern, by the look of the file names) are present but nothing imports them — there's no event bus instantiated anywhere.

If a task calls for, say, "queue an invoice job when a payment completes," that requires actually wiring it up end to end (create the queue in `workers/index.ts` or wherever appropriate, register `invoice.job.ts`'s handlers, and call `addJob(...)` from the relevant service) — there's no partial plumbing to just plug into.

## Adding a new job type to the existing `emails` queue

1. Add the handler to `jobs/email.job.ts`'s `emailHandlers` map (or wherever it's actually structured — check the current shape of that export before assuming).
2. `addJob("emails", { type: "your_new_type", data: {...} })` from the calling service.

No route/controller talks to the queue directly — enqueueing happens from services (e.g. after creating an account, enqueue a welcome email).
