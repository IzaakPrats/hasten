// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  useChatStore,
  type ConversationSummary,
  type MessageWithSections,
} from "./chat";

function conv(partial: Partial<ConversationSummary> = {}): ConversationSummary {
  const now = new Date();
  return {
    id: "c1",
    title: "Title",
    model: "claude-sonnet-4-6",
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

beforeEach(() => {
  useChatStore.getState().reset();
});

describe("useChatStore", () => {
  it("addConversation prepends and replaces same id", () => {
    useChatStore.getState().addConversation(conv({ id: "a", title: "One" }));
    useChatStore.getState().addConversation(conv({ id: "b", title: "Two" }));
    useChatStore.getState().addConversation(conv({ id: "a", title: "Updated" }));
    const { conversations } = useChatStore.getState();
    expect(conversations.map((c) => c.id)).toEqual(["a", "b"]);
    expect(conversations[0].title).toBe("Updated");
  });

  it("startStreaming clears sections and error", () => {
    useChatStore.setState({
      streamingMessageId: "old",
      streamingSections: new Map([["s", { id: "s", type: "paragraph", order: 0, content: "x" }]]),
      error: "oops",
    });
    useChatStore.getState().startStreaming("m1");
    const s = useChatStore.getState();
    expect(s.streamingMessageId).toBe("m1");
    expect(s.streamingSections.size).toBe(0);
    expect(s.error).toBeNull();
  });

  it("appendStreamingSection and appendStreamingDelta update map", () => {
    useChatStore.getState().startStreaming("m1");
    useChatStore.getState().appendStreamingSection("s1", "code", 0, "Snippet");
    useChatStore.getState().appendStreamingDelta("s1", "const ");
    useChatStore.getState().appendStreamingDelta("s1", "x = 1");
    const section = useChatStore.getState().streamingSections.get("s1");
    expect(section).toMatchObject({
      id: "s1",
      type: "code",
      order: 0,
      title: "Snippet",
      content: "const x = 1",
    });
  });

  it("cancelStreaming appends partial assistant from streaming map and clears", () => {
    useChatStore.setState({
      activeConversationId: "conv-1",
      messages: [
        {
          id: "u1",
          conversationId: "conv-1",
          role: "user",
          content: "hi",
          tokenCountIn: null,
          tokenCountOut: null,
          createdAt: new Date(),
          sections: [],
        },
      ],
      streamingMessageId: "streaming",
      streamingSections: new Map([
        [
          "s1",
          {
            id: "s1",
            type: "paragraph",
            order: 0,
            content: "partial",
          },
        ],
      ]),
    });
    useChatStore.getState().cancelStreaming();
    const s = useChatStore.getState();
    expect(s.streamingMessageId).toBeNull();
    expect(s.streamingSections.size).toBe(0);
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1].role).toBe("assistant");
    expect(s.messages[1].content).toContain("partial");
  });

  it("finishStreaming appends assistant message and clears streaming state", () => {
    useChatStore.setState({
      activeConversationId: "conv-1",
      messages: [],
    });
    useChatStore.getState().startStreaming("msg-assistant");
    useChatStore.getState().finishStreaming("msg-assistant", [
      { id: "sec1", type: "heading", title: "Hi", content: "body", order: 1 },
      { id: "sec0", type: "paragraph", content: "first", order: 0 },
    ]);
    const s = useChatStore.getState();
    expect(s.streamingMessageId).toBeNull();
    expect(s.streamingSections.size).toBe(0);
    expect(s.messages).toHaveLength(1);
    const assistant = s.messages[0];
    expect(assistant.role).toBe("assistant");
    expect(assistant.conversationId).toBe("conv-1");
    expect(assistant.sections.map((x) => x.order)).toEqual([0, 1]);
  });

  it("cancelStreaming appends partial assistant and clears streaming", () => {
    useChatStore.setState({
      activeConversationId: "conv-1",
      messages: [
        {
          id: "u1",
          conversationId: "conv-1",
          role: "user",
          content: "hi",
          tokenCountIn: null,
          tokenCountOut: null,
          createdAt: new Date(),
          sections: [],
        },
      ],
    });
    useChatStore.getState().startStreaming("streaming");
    useChatStore.getState().appendStreamingSection("s1", "paragraph", 0);
    useChatStore.getState().appendStreamingDelta("s1", "partial ");
    useChatStore.getState().cancelStreaming();
    const s = useChatStore.getState();
    expect(s.streamingMessageId).toBeNull();
    expect(s.streamingSections.size).toBe(0);
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1].role).toBe("assistant");
    expect(s.messages[1].content).toContain("partial");
  });

  it("setConversationTitle updates matching conversation", () => {
    useChatStore.getState().setConversations([
      conv({ id: "a", title: "Old" }),
      conv({ id: "b", title: "Keep" }),
    ]);
    useChatStore.getState().setConversationTitle("a", "New");
    const titles = useChatStore.getState().conversations.map((c) => c.title);
    expect(titles).toEqual(["New", "Keep"]);
  });

  it("removeConversation clears active thread messages", () => {
    const userMsg: MessageWithSections = {
      id: "m1",
      conversationId: "a",
      role: "user",
      content: "hi",
      tokenCountIn: null,
      tokenCountOut: null,
      createdAt: new Date(),
      sections: [],
    };
    useChatStore.setState({
      activeConversationId: "a",
      conversations: [conv({ id: "a" }), conv({ id: "b" })],
      messages: [userMsg],
    });
    useChatStore.getState().removeConversation("a");
    const s = useChatStore.getState();
    expect(s.conversations.map((c) => c.id)).toEqual(["b"]);
    expect(s.activeConversationId).toBeNull();
    expect(s.messages).toEqual([]);
  });

  it("openSubThread and closeSubThread toggle panel state", () => {
    useChatStore.getState().openSubThread("sec-1", { content: "ctx", type: "code" });
    expect(useChatStore.getState().activeSubThreadSectionId).toBe("sec-1");
    expect(useChatStore.getState().activeSubThreadPreview).toEqual({
      content: "ctx",
      type: "code",
    });
    useChatStore.getState().closeSubThread();
    expect(useChatStore.getState().activeSubThreadSectionId).toBeNull();
    expect(useChatStore.getState().activeSubThreadPreview).toBeNull();
  });
});
