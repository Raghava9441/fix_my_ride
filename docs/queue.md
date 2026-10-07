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

## Scheduled (cron) jobs

`jobs/scheduler.ts` (`startScheduledJobs()`, started from `workers/index.ts`) runs `node-cron` sweeps that are cross-tenant by design (no request context). Delivery goes through the `"emails"` queue via the `notification_email` handler in `jobs/notification.job.ts`:

| Schedule | Job | File |
|---|---|---|
| every 15 min | due/overdue vehicle reminders | `reminder.job.ts` |
| daily 06:00 | subscriptions expiring within 7 days | `subscription.job.ts` |
| daily 07:00 | mark past-due invoices `overdue` + notify | `invoice.job.ts` |
| daily 03:30 | archive notifications older than 90 days | `cleanup.job.ts` |

## What's *not* wired up

`jobs/report.job.ts` and `jobs/index.ts` are empty, as are `src/events/`, `src/subscribers/`, `src/repositories/`, `src/interfaces/` and `src/validators/` — there is no event bus and nothing imports them.

## Adding a new job type to the existing `emails` queue

1. Add the handler to `jobs/email.job.ts`'s `emailHandlers` map (or wherever it's actually structured — check the current shape of that export before assuming).
2. `addJob("emails", { type: "your_new_type", data: {...} })` from the calling service.

No route/controller talks to the queue directly — enqueueing happens from services (e.g. after creating an account, enqueue a welcome email).
