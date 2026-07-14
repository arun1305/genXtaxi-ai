import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum TicketStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
}

/** Human-handoff ticket (spec §2.6 support_tickets). */
@Schema({ collection: 'support_tickets', timestamps: { createdAt: true, updatedAt: true } })
export class SupportTicket {
  @Prop({ type: Types.ObjectId, ref: 'ChatSession', required: true, index: true })
  sessionId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId!: string;

  /** normal | high | urgent */
  @Prop({ required: true, default: 'normal' })
  priority!: string;

  @Prop({ enum: TicketStatus, default: TicketStatus.OPEN })
  status!: TicketStatus;

  @Prop()
  assigneeId?: string;

  @Prop({ required: true })
  summary!: string;

  /** refund | complaint | question | other — drives inbox filtering. */
  @Prop({ default: 'other' })
  category!: string;

  @Prop()
  csatScore?: number;

  @Prop()
  resolvedAt?: Date;
}

export type SupportTicketDocument = HydratedDocument<SupportTicket>;
export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
SupportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
