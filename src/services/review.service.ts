import mongoose from "mongoose";
import { Review } from "../models/Review";
import { ServiceCenter } from "../models/ServiceCenter";

export interface CreateReviewInput {
  rating: number;
  comment: string;
  serviceRecordId?: string;
}

export class ReviewService {
  async findByCenter(serviceCenterId: string): Promise<any[]> {
    return Review.findByCenter(serviceCenterId);
  }

  /**
   * Creates or replaces this account's review of the centre — the unique
   * (serviceCenterId, accountId) index means a customer has one review per
   * centre, so re-reviewing edits rather than stacking another rating onto
   * the average.
   */
  async upsertForCenter(
    serviceCenterId: string,
    accountId: string,
    input: CreateReviewInput,
  ): Promise<any | null> {
    const center = await ServiceCenter.findById(serviceCenterId);
    if (!center || center.isDeleted) {
      return null;
    }

    const review = await Review.findOneAndUpdate(
      {
        serviceCenterId: new mongoose.Types.ObjectId(serviceCenterId),
        accountId: new mongoose.Types.ObjectId(accountId),
        isDeleted: false,
      },
      {
        $set: {
          rating: input.rating,
          comment: input.comment,
          serviceRecordId: input.serviceRecordId
            ? new mongoose.Types.ObjectId(input.serviceRecordId)
            : undefined,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await this.syncCenterRating(serviceCenterId);

    return review;
  }

  /**
   * Recomputes the centre's cached rating from the Review collection. Kept as
   * a derived write so `stats.averageRating` can't drift from the reviews it
   * summarises.
   */
  async syncCenterRating(serviceCenterId: string): Promise<{ averageRating: number; totalReviews: number }> {
    const summary = await Review.getRatingSummary(serviceCenterId);

    await ServiceCenter.findByIdAndUpdate(serviceCenterId, {
      $set: {
        "stats.averageRating": summary.averageRating,
        "stats.totalReviews": summary.totalReviews,
      },
    });

    return summary;
  }
}

export const reviewService = new ReviewService();
