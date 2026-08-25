// models/Counter.ts
import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Generic atomic sequence counter (e.g. `key: "invoice:2026"`) used
 * anywhere a monotonically-increasing number is needed across concurrent
 * request handlers — a plain read-then-write `countDocuments()` is not
 * safe under concurrency (two requests can read the same count before
 * either writes), but `findOneAndUpdate` with `$inc` is atomic at the
 * MongoDB level.
 */
export interface ICounter extends Document {
  key: string;
  seq: number;
}

export interface ICounterModel extends Model<ICounter> {
  next(key: string): Promise<number>;
}

const counterSchema = new Schema<ICounter, ICounterModel>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function (
  this: ICounterModel,
  key: string,
): Promise<number> {
  const doc = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return doc.seq;
};

export const Counter = mongoose.model<ICounter, ICounterModel>("Counter", counterSchema);
