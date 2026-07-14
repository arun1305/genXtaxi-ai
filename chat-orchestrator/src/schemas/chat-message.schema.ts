import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MessageSender = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Chat message / turn (spec §2.6 chat_messages). Tool turns carry name/args/
 * result. A TTL index on createdAt enforces the retention policy (spec §5).
 */
@Schema({ collection: 'chat_messages', timestamps: { createdAt: true, updatedAt: false } })
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'ChatSession', required: true, index: true })
  sessionId!: Types.ObjectId;

  @Prop({ required: true })
  sender!: MessageSender;

  @Prop({ default: '' })
  content!: string;

  @Prop()
  toolName?: string;

  @Prop({ type: Object })
  toolArgs?: Record<string, unknown>;

  @Prop({ type: Object })
  toolResult?: Record<string, unknown>;

  @Prop({ default: 0 })
  tokens!: number;

  @Prop()
  createdAt!: Date;
}

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
// TTL retention — expireAfterSeconds patched at bootstrap from CHAT_RETENTION_DAYS.
ChatMessageSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90, name: 'ttl_retention' },
);
