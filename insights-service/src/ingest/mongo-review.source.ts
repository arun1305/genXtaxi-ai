import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RideReadModel, RideReadDocument } from './ride.readmodel';
import { RawReview, ReviewSource } from './review-source';

/**
 * Reads ratings embedded in the rides collection (driverRating = passenger→driver,
 * passengerRating = driver→passenger) and emits them as raw reviews newer than
 * the watermark, ordered by ratedAt so the watermark advances monotonically.
 */
@Injectable()
export class MongoReviewSource implements ReviewSource {
  constructor(
    @InjectModel(RideReadModel.name)
    private readonly rides: Model<RideReadDocument>,
  ) {}

  async pullSince(
    watermark: Date,
    limit: number,
  ): Promise<{ reviews: RawReview[]; newWatermark: Date }> {
    const docs = await this.rides
      .find({
        $or: [
          { 'driverRating.ratedAt': { $gt: watermark } },
          { 'passengerRating.ratedAt': { $gt: watermark } },
        ],
      })
      .sort({ updatedAt: 1 })
      .limit(limit)
      .lean();

    const reviews: RawReview[] = [];
    let newWatermark = watermark;

    for (const ride of docs) {
      const rideId = String((ride as { _id: unknown })._id);
      // passenger rated the driver
      const dr = ride.driverRating;
      if (dr?.ratedAt && dr.ratedAt > watermark && ride.driver && ride.passenger) {
        reviews.push({
          rideId,
          authorId: String(ride.passenger),
          subjectId: String(ride.driver),
          subjectType: 'driver',
          rating: dr.rating ?? 0,
          text: dr.review ?? '',
          zoneId: ride.zoneId,
          createdAt: dr.ratedAt,
        });
        if (dr.ratedAt > newWatermark) newWatermark = dr.ratedAt;
      }
      // driver rated the passenger
      const pr = ride.passengerRating;
      if (pr?.ratedAt && pr.ratedAt > watermark && ride.driver && ride.passenger) {
        reviews.push({
          rideId,
          authorId: String(ride.driver),
          subjectId: String(ride.passenger),
          subjectType: 'rider',
          rating: pr.rating ?? 0,
          text: pr.review ?? '',
          zoneId: ride.zoneId,
          createdAt: pr.ratedAt,
        });
        if (pr.ratedAt > newWatermark) newWatermark = pr.ratedAt;
      }
    }

    return { reviews, newWatermark };
  }
}
