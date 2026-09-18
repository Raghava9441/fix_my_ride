// models/Review.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { tenantPlugin } from '../middleware/tenant/tenantPlugin';

export interface IReview extends Document {
  tenantId?: Types.ObjectId;

  serviceCenterId: Types.ObjectId;
  /** The Account that left the review. */
  accountId: Types.ObjectId;
  /** Optional link to the job being reviewed. */
  serviceRecordId?: Types.ObjectId;

  rating: number;
  comment: string;

  /** Set once a staff member responds to the review. */
  response?: {
    comment?: string;
    respondedBy?: Types.ObjectId;
    respondedAt?: Date;
  };

  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReviewModel extends Model<IReview> {
  findByCenter(
    serviceCenterId: string | Types.ObjectId,
    options?: { includeDeleted?: boolean },
  ): mongoose.Query<IReview[], IReview>;
  /** Mean rating and review count for a centre, both 0 when it has no reviews. */
  getRatingSummary(
    serviceCenterId: string | Types.ObjectId,
  ): Promise<{ averageRating: number; totalReviews: number }>;
}

const reviewSchema = new Schema<IReview, IReviewModel>({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },

  serviceCenterId: {
    type: Schema.Types.ObjectId,
    ref: 'ServiceCenter',
    required: true,
    index: true
  },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  serviceRecordId: {
    type: Schema.Types.ObjectId,
    ref: 'ServiceRecord'
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },

  response: {
    comment: { type: String, maxlength: 1000 },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
    respondedAt: Date
  },

  isDeleted: { type: Boolean, default: false },
  deletedAt: Date

}, { timestamps: true });

// One review per account per centre — re-reviewing updates the existing entry
// rather than letting a single customer skew a centre's average.
reviewSchema.index(
  { serviceCenterId: 1, accountId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
reviewSchema.index({ serviceCenterId: 1, createdAt: -1 });

// ─── Statics ────────────────────────────────────────────────────────────────

reviewSchema.statics.findByCenter = function (
  this: IReviewModel,
  serviceCenterId: string | Types.ObjectId,
  options: { includeDeleted?: boolean } = {}
) {
  const query: any = { serviceCenterId };
  if (!options.includeDeleted) query.isDeleted = false;

  return this.find(query)
    .populate('accountId', 'email')
    .sort({ createdAt: -1 });
};

reviewSchema.statics.getRatingSummary = async function (
  this: IReviewModel,
  serviceCenterId: string | Types.ObjectId
) {
  const [summary] = await this.aggregate([
    {
      $match: {
        serviceCenterId: new mongoose.Types.ObjectId(String(serviceCenterId)),
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (!summary) {
    return { averageRating: 0, totalReviews: 0 };
  }

  return {
    // Two decimals is enough for a star rating and keeps the stored figure
    // stable rather than carrying float noise into ServiceCenter.stats.
    averageRating: Math.round(summary.averageRating * 100) / 100,
    totalReviews: summary.totalReviews
  };
};

reviewSchema.plugin(tenantPlugin);

export const Review = mongoose.model<IReview, IReviewModel>('Review', reviewSchema);
