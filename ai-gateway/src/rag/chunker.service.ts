import { Injectable } from '@nestjs/common';

export interface Chunk {
  content: string;
  index: number;
}

/**
 * Token-aware-ish text chunker for RAG ingestion. Splits on paragraph/sentence
 * boundaries with a target size and overlap so retrieved context stays
 * coherent. Deliberately dependency-free (approximates tokens via chars).
 */
@Injectable()
export class ChunkerService {
  private readonly targetChars = 1200; // ~300 tokens
  private readonly overlapChars = 200;

  chunk(text: string): Chunk[] {
    const clean = text.replace(/\r\n/g, '\n').trim();
    if (!clean) return [];

    const paragraphs = clean.split(/\n{2,}/);
    const chunks: Chunk[] = [];
    let buffer = '';

    const flush = () => {
      const trimmed = buffer.trim();
      if (trimmed) chunks.push({ content: trimmed, index: chunks.length });
      // keep an overlap tail for continuity
      buffer =
        trimmed.length > this.overlapChars
          ? trimmed.slice(trimmed.length - this.overlapChars)
          : '';
    };

    for (const para of paragraphs) {
      if ((buffer + '\n\n' + para).length > this.targetChars && buffer) {
        flush();
      }
      buffer += (buffer ? '\n\n' : '') + para;
      // very long paragraph: hard-split by sentence
      while (buffer.length > this.targetChars * 1.5) {
        const cut = buffer.lastIndexOf('. ', this.targetChars);
        const at = cut > this.targetChars / 2 ? cut + 1 : this.targetChars;
        chunks.push({ content: buffer.slice(0, at).trim(), index: chunks.length });
        buffer = buffer.slice(at - this.overlapChars);
      }
    }
    flush();
    return chunks;
  }
}
