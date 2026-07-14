import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum SessionStatus {
  ACTIVE = 'active',
  ESCALATED = 'escalated',
  CLOSED = 'closed',
}

/** Chatbot session (spec §2.6 chat_sessions). */
@Schema({ collection: 'chat_sessions', timestamps: { createdAt: true, updatedAt: false } })
export class ChatSession {
  @Prop({ required: true, index: true })
  userId!: string;

  /** passenger | driver */
  @Prop({ required: true })
  role!: string;

  @Prop({ required: true, default: 'fr' })
  lang!: string;

  @Prop({ enum: SessionStatus, default: SessionStatus.ACTIVE, index: true })
  status!: SessionStatus;

  /** Optional deep-link topic (spec §2.2 genxtaxi://support/chat?topic=). */
  @Prop()
  topic?: string;

  @Prop({ default: () => new Date() })
  lastActivityAt!: Date;

  @Prop()
  createdAt!: Date;
}

export type ChatSessionDocument = HydratedDocument<ChatSession>;
export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
ChatSessionSchema.index({ userId: 1, lastActivityAt: -1 });
