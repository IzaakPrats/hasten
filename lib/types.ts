import type {
  Conversation,
  Message,
  Section,
  SubThread,
  SubThreadMessage,
} from "@prisma/client";

export const SECTION_TYPES = [
  "paragraph",
  "code",
  "list",
  "heading",
  "table",
  "quote",
] as const;

export type SectionType = (typeof SECTION_TYPES)[number];

export type MessageWithSections = Message & { sections: Section[] };

export type ConversationWithMessages = Conversation & {
  messages: MessageWithSections[];
};

export type SubThreadWithMessages = SubThread & {
  messages: SubThreadMessage[];
};

// SSE event payloads
export interface SSESectionStart {
  sectionId: string;
  type: SectionType;
  order: number;
  title?: string;
}

export interface SSEDelta {
  sectionId: string;
  content: string;
}

export interface SSESectionEnd {
  sectionId: string;
}

export interface SSEDone {
  messageId: string;
  usage: { tokensIn: number; tokensOut: number };
}

export interface SSEError {
  error: string;
  code: string;
}

export type SSEEvent =
  | { event: "section_start"; data: SSESectionStart }
  | { event: "delta"; data: SSEDelta }
  | { event: "section_end"; data: SSESectionEnd }
  | { event: "done"; data: SSEDone }
  | { event: "error"; data: SSEError };

// Accumulated section for persistence (content without tags)
export interface ParsedSection {
  id: string;
  type: SectionType;
  title?: string;
  content: string;
  order: number;
}
