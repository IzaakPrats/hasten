import { v4 as uuidv4 } from "uuid";
import type { SectionType } from "./types";
import { SECTION_TYPES } from "./types";

// type required; optional title (e.g. title="Overview")
const OPEN_TAG_REGEX = /<section\s+type="([^"]+)"(?:\s+title="([^"]*)")?\s*>/i;
const CLOSE_TAG = "</section>";

const FALLBACK_TOKEN_LIMIT = 200;

export interface SectionStartEvent {
  sectionId: string;
  type: SectionType;
  order: number;
  title?: string;
}

export interface DeltaEvent {
  sectionId: string;
  content: string;
}

export interface SectionEndEvent {
  sectionId: string;
}

export type SectionParserEvent =
  | { kind: "section_start"; data: SectionStartEvent }
  | { kind: "delta"; data: DeltaEvent }
  | { kind: "section_end"; data: SectionEndEvent };

function isValidSectionType(s: string): s is SectionType {
  return SECTION_TYPES.includes(s as SectionType);
}

export async function* parseSectionStream(
  chunkStream: AsyncIterable<string>,
): AsyncGenerator<SectionParserEvent, void, undefined> {
  let buffer = "";
  let currentSectionId: string | null = null;
  let currentType: SectionType = "paragraph";
  let currentTitle: string | undefined = undefined;
  let currentOrder = 0;
  let currentContent = "";
  let tokensSinceLastSection = 0;
  let fallbackSectionId: string | null = null;

  for await (const chunk of chunkStream) {
    buffer += chunk;
    tokensSinceLastSection += 1;

    // If we're inside a section, look for close tag and emit deltas
    if (currentSectionId) {
      const closeIdx = buffer.indexOf(CLOSE_TAG);
      if (closeIdx !== -1) {
        const beforeClose = buffer.slice(0, closeIdx);
        const afterClose = buffer.slice(closeIdx + CLOSE_TAG.length);
        currentContent += beforeClose;
        if (currentContent) {
          yield {
            kind: "delta",
            data: { sectionId: currentSectionId, content: currentContent },
          };
        }
        yield { kind: "section_end", data: { sectionId: currentSectionId } };
        buffer = afterClose;
        currentSectionId = null;
        currentContent = "";
        continue;
      }
      // No close yet: emit content up to any possible start tag (next section)
      const openMatch = buffer.match(OPEN_TAG_REGEX);
      if (openMatch && openMatch.index !== undefined) {
        const textBefore = buffer.slice(0, openMatch.index);
        currentContent += textBefore;
        if (currentContent) {
          yield {
            kind: "delta",
            data: { sectionId: currentSectionId, content: currentContent },
          };
        }
        yield { kind: "section_end", data: { sectionId: currentSectionId } };
        currentContent = "";
        buffer = buffer.slice(openMatch.index + openMatch[0].length);
        const typeStr = openMatch[1].toLowerCase();
        currentType = isValidSectionType(typeStr) ? typeStr : "paragraph";
        currentTitle =
          openMatch[2] !== undefined && openMatch[2] !== ""
            ? openMatch[2]
            : undefined;
        currentSectionId = uuidv4();
        currentOrder += 1;
        yield {
          kind: "section_start",
          data: {
            sectionId: currentSectionId,
            type: currentType,
            order: currentOrder - 1,
            title: currentTitle,
          },
        };
        tokensSinceLastSection = 0;
        continue;
      }
      // Flush safe content (no open/close tag start)
      const safeEnd = Math.max(
        buffer.lastIndexOf("<"),
        buffer.lastIndexOf(">"),
      );
      if (safeEnd === -1) {
        currentContent += buffer;
        buffer = "";
      } else {
        currentContent += buffer.slice(0, safeEnd);
        buffer = buffer.slice(safeEnd);
      }
      continue;
    }

    // Not inside a section: look for open tag
    const openMatch = buffer.match(OPEN_TAG_REGEX);
    if (openMatch && openMatch.index !== undefined) {
      const textBefore = buffer.slice(0, openMatch.index).trim();
      if (textBefore && fallbackSectionId) {
        yield {
          kind: "delta",
          data: { sectionId: fallbackSectionId, content: textBefore },
        };
        yield { kind: "section_end", data: { sectionId: fallbackSectionId } };
        fallbackSectionId = null;
      }
      const typeStr = openMatch[1].toLowerCase();
      currentType = isValidSectionType(typeStr) ? typeStr : "paragraph";
      currentTitle =
        openMatch[2] !== undefined && openMatch[2] !== ""
          ? openMatch[2]
          : undefined;
      currentSectionId = uuidv4();
      currentOrder += 1;
      yield {
        kind: "section_start",
        data: {
          sectionId: currentSectionId,
          type: currentType,
          order: currentOrder - 1,
          title: currentTitle,
        },
      };
      buffer = buffer.slice(openMatch.index + openMatch[0].length);
      tokensSinceLastSection = 0;
      currentContent = "";
      continue;
    }

    // Fallback: no open tag within limit → single paragraph section
    if (
      tokensSinceLastSection >= FALLBACK_TOKEN_LIMIT &&
      !currentSectionId &&
      !fallbackSectionId
    ) {
      fallbackSectionId = uuidv4();
      yield {
        kind: "section_start",
        data: { sectionId: fallbackSectionId, type: "paragraph", order: 0 },
      };
    }
    if (fallbackSectionId) {
      const safeEnd = Math.max(buffer.indexOf("<"), -1);
      if (safeEnd === -1) {
        if (buffer) {
          yield {
            kind: "delta",
            data: { sectionId: fallbackSectionId, content: buffer },
          };
          buffer = "";
        }
      } else {
        const text = buffer.slice(0, safeEnd);
        if (text) {
          yield {
            kind: "delta",
            data: { sectionId: fallbackSectionId, content: text },
          };
        }
        buffer = buffer.slice(safeEnd);
      }
    }
  }

  // Flush remaining buffer
  if (currentSectionId && currentContent) {
    yield {
      kind: "delta",
      data: { sectionId: currentSectionId, content: currentContent },
    };
    yield { kind: "section_end", data: { sectionId: currentSectionId } };
  } else if (currentSectionId) {
    yield { kind: "section_end", data: { sectionId: currentSectionId } };
  }
  if (fallbackSectionId && buffer) {
    yield {
      kind: "delta",
      data: { sectionId: fallbackSectionId, content: buffer },
    };
    yield { kind: "section_end", data: { sectionId: fallbackSectionId } };
  }
}

export interface ParsedSectionForDb {
  id: string;
  type: SectionType;
  title?: string;
  content: string;
  order: number;
}

export function collectSectionsFromEvents(
  events: SectionParserEvent[],
): ParsedSectionForDb[] {
  const sections: Map<string, ParsedSectionForDb> = new Map();
  for (const ev of events) {
    if (ev.kind === "section_start") {
      sections.set(ev.data.sectionId, {
        id: ev.data.sectionId,
        type: ev.data.type,
        title: ev.data.title,
        content: "",
        order: ev.data.order,
      });
    } else if (ev.kind === "delta") {
      const s = sections.get(ev.data.sectionId);
      if (s) s.content += ev.data.content;
    }
  }
  return Array.from(sections.values()).sort((a, b) => a.order - b.order);
}
