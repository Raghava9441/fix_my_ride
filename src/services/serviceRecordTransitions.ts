export type RecordStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

/**
 * Which status a job may move to from each status.
 *
 *   scheduled ──▶ in_progress ──▶ completed
 *       │  ▲          │
 *       │  └──────────┤   (a job pulled back by mistake)
 *       ▼             ▼
 *    cancelled ──▶ scheduled   (a cancellation undone)
 *
 * `completed` is terminal. Completing a job has one-time consequences - the
 * odometer reading, the vehicle's next-service schedule and the center's
 * revenue - and nothing undoes them, so reopening a completed job would let
 * the next completion apply them a second time. A mistaken completion needs
 * a deliberate correction, not a drag back across a board.
 */
const ALLOWED: Record<RecordStatus, RecordStatus[]> = {
  scheduled: ["in_progress", "completed", "cancelled"],
  in_progress: ["scheduled", "completed", "cancelled"],
  completed: [],
  cancelled: ["scheduled"],
};

export function canTransition(from: RecordStatus, to: RecordStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: RecordStatus): RecordStatus[] {
  return ALLOWED[from] ?? [];
}

/** Thrown for a status change the lifecycle doesn't allow; the controller maps it to 409. */
export class InvalidTransitionError extends Error {
  constructor(
    readonly from: RecordStatus,
    readonly to: RecordStatus,
  ) {
    super(`A ${from.replace("_", " ")} job can't be moved to ${to.replace("_", " ")}`);
    this.name = "InvalidTransitionError";
  }
}
