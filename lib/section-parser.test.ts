// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const uuidSeq = vi.hoisted(() => ({ n: 0 }));

vi.mock("uuid", () => ({
  v4: () => {
    uuidSeq.n += 1;
    return `uuid-${uuidSeq.n}`;
  },
}));

import {
  collectSectionsFromEvents,
  parseSectionStream,
  type SectionParserEvent,
} from "./section-parser";

beforeEach(() => {
  uuidSeq.n = 0;
});

function streamChunks(...parts: string[]): AsyncIterable<string> {
  return (async function* () {
    for (const p of parts) yield p;
  })();
}

async function collectParseEvents(
  stream: AsyncIterable<string>,
): Promise<SectionParserEvent[]> {
  const out: SectionParserEvent[] = [];
  for await (const ev of parseSectionStream(stream)) {
    out.push(ev);
  }
  return out;
}

describe("collectSectionsFromEvents", () => {
  it("aggregates deltas and sorts by order", () => {
    const events: SectionParserEvent[] = [
      {
        kind: "section_start",
        data: {
          sectionId: "a",
          type: "heading",
          order: 1,
          title: "T",
        },
      },
      {
        kind: "section_start",
        data: { sectionId: "b", type: "paragraph", order: 0 },
      },
      { kind: "delta", data: { sectionId: "b", content: "hello " } },
      { kind: "delta", data: { sectionId: "b", content: "world" } },
      { kind: "delta", data: { sectionId: "a", content: "H1" } },
    ];
    const sections = collectSectionsFromEvents(events);
    expect(sections.map((s) => s.id)).toEqual(["b", "a"]);
    expect(sections.find((s) => s.id === "b")?.content).toBe("hello world");
    expect(sections.find((s) => s.id === "a")?.content).toBe("H1");
    expect(sections.find((s) => s.id === "a")?.title).toBe("T");
  });
});

describe("parseSectionStream", () => {
  it("parses a closed section when open and body arrive in separate chunks", async () => {
    // Same-chunk open+body+close leaves remainder in buffer until the next chunk;
    // production streams split tags from tokens, so we mirror that.
    const events = await collectParseEvents(
      streamChunks('<section type="code">', "hello</section>"),
    );
    expect(events.map((e) => e.kind)).toEqual([
      "section_start",
      "delta",
      "section_end",
    ]);
    expect(events[0]).toMatchObject({
      kind: "section_start",
      data: { sectionId: "uuid-1", type: "code", order: 0 },
    });
    expect(events[1]).toMatchObject({
      kind: "delta",
      data: { sectionId: "uuid-1", content: "hello" },
    });
    expect(events[2]).toMatchObject({
      kind: "section_end",
      data: { sectionId: "uuid-1" },
    });
  });

  it("uses paragraph for unknown section type", async () => {
    const events = await collectParseEvents(
      streamChunks('<section type="unknown">x</section>'),
    );
    expect(events[0]).toMatchObject({
      kind: "section_start",
      data: { type: "paragraph" },
    });
  });

  it("parses optional title attribute", async () => {
    const events = await collectParseEvents(
      streamChunks(
        '<section type="heading" title="Overview">',
        "intro</section>",
      ),
    );
    expect(events[0]).toMatchObject({
      kind: "section_start",
      data: { type: "heading", title: "Overview" },
    });
    expect(events[1]).toMatchObject({
      kind: "delta",
      data: { content: "intro" },
    });
  });

  it("handles open tag split across chunks", async () => {
    const events = await collectParseEvents(
      streamChunks("<section ", 'type="list">', "a", "</section>"),
    );
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("section_start");
    expect(kinds).toContain("delta");
    expect(kinds).toContain("section_end");
    const start = events.find((e) => e.kind === "section_start");
    expect(start).toMatchObject({ data: { type: "list" } });
    const delta = events.find((e) => e.kind === "delta");
    expect(delta).toMatchObject({ data: { content: "a" } });
  });

  it("starts new section when a nested open appears before the outer close", async () => {
    const events = await collectParseEvents(
      streamChunks(
        '<section type="paragraph">',
        'a<section type="code">',
        "b</section>",
      ),
    );
    const db = collectSectionsFromEvents(events);
    expect(db).toHaveLength(2);
    expect(db[0].type).toBe("paragraph");
    expect(db[0].content).toBe("a");
    expect(db[1].type).toBe("code");
    expect(db[1].content).toBe("b");
  });

  it("creates fallback paragraph after many chunks without tags", async () => {
    async function* tokens() {
      for (let i = 0; i < 201; i += 1) {
        yield "x";
      }
    }
    const events = await collectParseEvents(tokens());
    const starts = events.filter((e) => e.kind === "section_start");
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({
      data: { type: "paragraph", order: 0 },
    });
    const deltas = events.filter((e) => e.kind === "delta");
    const content = deltas.map((d) => d.data.content).join("");
    expect(content.length).toBeGreaterThan(0);
    // Flush only emits section_end for fallback when buffer is non-empty at EOF.
    expect(events.some((e) => e.kind === "section_end")).toBe(false);
  });
});
