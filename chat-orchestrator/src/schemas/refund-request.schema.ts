import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum RefundStatus {
  QUEUED = 'queued',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Refund request queued for admin (per the Phase 2 decision: all refunds queue
 * to admin — no auto-approve). Money is {amount, currency} minor units; the
 * currency MUST match the original charge (spec §2.4 initiate_refund).
 */
@Schema({ collection: 'refund_requests', timestamps: true })
export class RefundRequest {
  @Prop({ type: Types.ObjectId, ref: 'SupportTicket', required: true, index: true })
  ticketId!: Types.ObjectId;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  rideId!: string;

  @Prop({ type: Object, required: true })
  amount!: { amount: number; currency: string };

  @Prop({ required: true })
  reason!: string;

  @Prop({ enum: RefundStatus, default: RefundStatus.QUEUED, index: true })
  status!: RefundStatus;

  @Prop()
  decidedBy?: string;

  @Prop()
  decidedAt?: Date;
}

export type RefundRequestDocument = HydratedDocument<RefundRequest>;
export const RefundRequestSchema = SchemaFactory.createForClass(RefundRequest);
RefundRequestSchema.index({ status: 1, createdAt: -1 });
