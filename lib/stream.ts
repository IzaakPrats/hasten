import { v4 as uuidv4 } from "uuid";
import { anthropic } from "./anthropic";
import { db } from "./db";
import { SECTION_SYSTEM_PROMPT } from "./prompts";
import { parseSectionStream, collectSectionsFromEvents } from "./section-parser";
import type { ParsedSectionForDb } from "./section-parser";
import type { SectionParserEvent } from "./section-parser";

export function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function createChunkQueue(): {
  iterable: AsyncIterable<string>;
  push: (chunk: string) => void;
  done: () => void;
} {
  const queue: string[] = [];
  let done = false;
  let resolve: (() => void) | null = null;

  const iterable = {
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }
        if (done) return;
        await new Promise<void>((r) => {
          resolve = r;
        });
      }
    },
  };

  return {
    iterable,
    push(chunk: string) {
      if (!chunk) return;
      queue.push(chunk);
      if (resolve) {
        resolve();
        resolve = null;
      }
    },
    done() {
      done = true;
      if (resolve) {
        resolve();
        resolve = null;
      }
    },
  };
}

type StreamEvent = {
  type: string;
  delta?: { type?: string; text?: string };
  message?: { usage?: { input_tokens?: number } };
  usage?: { output_tokens?: number };
};

export interface StreamConversationParams {
  conversationId: string;
  model: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface StreamResult {
  messageId: string;
  usage: { tokensIn: number; tokensOut: number };
  sections: ParsedSectionForDb[];
}

export interface StreamConversationOptions {
  /** Run and await before sending the "done" event (e.g. send title first). */
  beforeDone?: () => Promise<void>;
}

export async function streamConversationResponse(
  params: StreamConversationParams,
  write: (chunk: string) => void,
  options?: StreamConversationOptions
): Promise<StreamResult> {
  const { conversationId, model, messages } = params;
  const assistantMessageId = uuidv4();

  let tokensIn = 0;
  let tokensOut = 0;
  const parserEvents: SectionParserEvent[] = [];

  const apiMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const stream = await anthropic.messages.create({
    model: model as "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SECTION_SYSTEM_PROMPT,
    messages: apiMessages,
    stream: true,
  });

  const chunkQueue = createChunkQueue();

  const streamLoop = async () => {
    for await (const event of stream as AsyncIterable<StreamEvent>) {
      if (event.type === "message_start" && event.message?.usage?.input_tokens != null) {
        tokensIn = event.message.usage.input_tokens;
      }
      if (event.type === "message_delta" && event.usage?.output_tokens != null) {
        tokensOut = event.usage.output_tokens;
      }
      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        chunkQueue.push(event.delta.text);
      }
    }
    chunkQueue.done();
  };

  const parserLoop = async () => {
    for await (const ev of parseSectionStream(chunkQueue.iterable)) {
      parserEvents.push(ev);
      if (ev.kind === "section_start") {
        write(
          formatSSE("section_start", {
            sectionId: ev.data.sectionId,
            type: ev.data.type,
            order: ev.data.order,
            ...(ev.data.title != null && { title: ev.data.title }),
          })
        );
      } else if (ev.kind === "delta") {
        write(formatSSE("delta", { sectionId: ev.data.sectionId, content: ev.data.content }));
      } else if (ev.kind === "section_end") {
        write(formatSSE("section_end", { sectionId: ev.data.sectionId }));
      }
    }
  };

  await Promise.all([streamLoop(), parserLoop()]);

  const sections = collectSectionsFromEvents(parserEvents);
  const fullContent = sections
    .map((s) => (s.title ? s.title + "\n\n" + s.content : s.content))
    .join("\n\n");

  await db.message.create({
    data: {
      id: assistantMessageId,
      conversationId,
      role: "assistant",
      content: fullContent,
      tokenCountIn: tokensIn,
      tokenCountOut: tokensOut,
    },
  });

  await db.section.createMany({
    data: sections.map((s) => ({
      id: s.id,
      messageId: assistantMessageId,
      type: s.type,
      title: s.title ?? null,
      content: s.content,
      order: s.order,
    })),
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  await options?.beforeDone?.();

  write(
    formatSSE("done", {
      messageId: assistantMessageId,
      usage: { tokensIn, tokensOut },
    })
  );

  return {
    messageId: assistantMessageId,
    usage: { tokensIn, tokensOut },
    sections,
  };
}
