import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PromptStatus,
  PromptTemplate,
  PromptTemplateDocument,
} from '../schemas/prompt-template.schema';
import { CreatePromptDto } from './dto/prompt.dto';

/**
 * Versioned prompt registry (spec §5: prompts live in a versioned store, not
 * inline strings; §2.5 versioned system prompt). Creating a new draft bumps the
 * version; publishing atomically retires the prior published version so exactly
 * one is live per key — giving a clean rollback path.
 */
@Injectable()
export class PromptsService {
  constructor(
    @InjectModel(PromptTemplate.name)
    private readonly model: Model<PromptTemplateDocument>,
  ) {}

  async createDraft(
    dto: CreatePromptDto,
    createdBy?: string,
  ): Promise<PromptTemplateDocument> {
    const latest = await this.model
      .findOne({ key: dto.key })
      .sort({ version: -1 })
      .lean();
    const version = (latest?.version ?? 0) + 1;
    return this.model.create({
      key: dto.key,
      version,
      task: dto.task,
      content: dto.content,
      variables: dto.variables ?? this.extractVars(dto.content),
      status: PromptStatus.DRAFT,
      createdBy,
    });
  }

  async publish(key: string, version: number): Promise<PromptTemplateDocument> {
    const target = await this.model.findOne({ key, version });
    if (!target) throw new NotFoundException(`Prompt ${key} v${version} not found`);

    await this.model.updateMany(
      { key, status: PromptStatus.PUBLISHED },
      { $set: { status: PromptStatus.RETIRED } },
    );
    target.status = PromptStatus.PUBLISHED;
    target.publishedAt = new Date();
    return target.save();
  }

  /** Resolve the currently published version for a key (used by orchestrators). */
  async resolvePublished(key: string): Promise<PromptTemplateDocument> {
    const doc = await this.model.findOne({
      key,
      status: PromptStatus.PUBLISHED,
    });
    if (!doc) throw new NotFoundException(`No published prompt for key ${key}`);
    return doc;
  }

  list(key?: string): Promise<PromptTemplateDocument[]> {
    return this.model
      .find(key ? { key } : {})
      .sort({ key: 1, version: -1 })
      .exec();
  }

  /** Sandbox render (spec §2.3: preview prompt changes before publishing). */
  render(content: string, variables: Record<string, string> = {}): string {
    return content.replace(/\{(\w+)\}/g, (_, name) =>
      name in variables ? variables[name] : `{${name}}`,
    );
  }

  async preview(
    key: string,
    version: number,
    variables: Record<string, string> = {},
  ): Promise<{ rendered: string }> {
    const doc = await this.model.findOne({ key, version });
    if (!doc) throw new NotFoundException(`Prompt ${key} v${version} not found`);
    return { rendered: this.render(doc.content, variables) };
  }

  private extractVars(content: string): string[] {
    return [...new Set([...content.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
  }
}
