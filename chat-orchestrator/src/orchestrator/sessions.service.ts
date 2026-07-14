import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage as SharedMessage } from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';
import {
  ChatSession,
  ChatSessionDocument,
  SessionStatus,
} from '../schemas/chat-session.schema';
import {
  ChatMessage,
  ChatMessageDocument,
  MessageSender,
} from '../schemas/chat-message.schema';

/** Owns chat_sessions + chat_messages persistence and context windowing. */
@Injectable()
export class SessionsService {
  private readonly contextTurns: number;

  constructor(
    config: ConfigService<AppEnv, true>,
    @InjectModel(ChatSession.name)
    private readonly sessions: Model<ChatSessionDocument>,
    @InjectModel(ChatMessage.name)
    private readonly messages: Model<ChatMessageDocument>,
  ) {
    this.contextTurns = config.get('SESSION_CONTEXT_TURNS', { infer: true });
  }

  create(input: {
    userId: string;
    role: string;
    lang: string;
    topic?: string;
  }): Promise<ChatSessionDocument> {
    return this.sessions.create({ ...input, status: SessionStatus.ACTIVE });
  }

  async get(sessionId: string, userId: string): Promise<ChatSessionDocument> {
    const s = await this.sessions.findById(sessionId);
    if (!s || s.userId !== userId) throw new NotFoundException('Session not found');
    return s;
  }

  async touch(sessionId: string): Promise<void> {
    await this.sessions.updateOne(
      { _id: sessionId },
      { $set: { lastActivityAt: new Date() } },
    );
  }

  async setStatus(sessionId: string, status: SessionStatus): Promise<void> {
    await this.sessions.updateOne({ _id: sessionId }, { $set: { status } });
  }

  addMessage(input: {
    sessionId: string;
    sender: MessageSender;
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: Record<string, unknown>;
    tokens?: number;
  }): Promise<ChatMessageDocument> {
    return this.messages.create({
      sessionId: new Types.ObjectId(input.sessionId),
      sender: input.sender,
      content: input.content ?? '',
      toolName: input.toolName,
      toolArgs: input.toolArgs,
      toolResult: input.toolResult,
      tokens: input.tokens ?? 0,
    });
  }

  /** Full transcript (spec §2.7 GET /sessions/:id). */
  transcript(sessionId: string): Promise<ChatMessageDocument[]> {
    return this.messages
      .find({ sessionId: new Types.ObjectId(sessionId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  /** Last K turns as LLM messages for the prompt window (spec §2.4 step 1). */
  async recentContext(sessionId: string): Promise<SharedMessage[]> {
    const docs = await this.messages
      .find({
        sessionId: new Types.ObjectId(sessionId),
        sender: { $in: ['user', 'assistant'] },
      })
      .sort({ createdAt: -1 })
      .limit(this.contextTurns)
      .lean();
    return docs
      .reverse()
      .map((d) => ({
        role: d.sender as 'user' | 'assistant',
        content: d.content,
      }));
  }
}
