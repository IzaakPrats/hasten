import { create } from "zustand";
import type { Section } from "@prisma/client";
import type { SectionType } from "@/lib/types";

export interface ConversationSummary {
  id: string;
  title: string | null;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SectionWithCount extends Section {
  _count?: { threads: number };
  /** First subthread's message count (included when loading conversation) */
  threads?: { _count: { messages: number } }[];
}

export interface MessageWithSections {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  tokenCountIn: number | null;
  tokenCountOut: number | null;
  createdAt: Date;
  sections: SectionWithCount[];
}

export interface StreamingSection {
  id: string;
  type: SectionType;
  order: number;
  title?: string;
  content: string;
}

interface ChatState {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  messages: MessageWithSections[];
  streamingMessageId: string | null;
  streamingSections: Map<string, StreamingSection>;
  error: string | null;
  setConversations: (conversations: ConversationSummary[]) => void;
  addConversation: (conversation: ConversationSummary) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (messages: MessageWithSections[]) => void;
  addUserMessage: (message: MessageWithSections) => void;
  startStreaming: (messageId: string) => void;
  appendStreamingSection: (
    sectionId: string,
    type: SectionType,
    order: number,
    title?: string,
  ) => void;
  appendStreamingDelta: (sectionId: string, content: string) => void;
  finishStreaming: (
    messageId: string,
    sections: {
      id: string;
      type: SectionType;
      title?: string;
      content: string;
      order: number;
    }[],
  ) => void;
  setStreamingError: (error: string | null) => void;
  setConversationTitle: (conversationId: string, title: string) => void;
  removeConversation: (conversationId: string) => void;
  reset: () => void;
  activeSubThreadSectionId: string | null;
  activeSubThreadPreview: { content: string; type: SectionType } | null;
  openSubThread: (
    sectionId: string,
    preview: { content: string; type: SectionType },
  ) => void;
  closeSubThread: () => void;
}

const initialState = {
  conversations: [],
  activeConversationId: null,
  messages: [],
  streamingMessageId: null,
  streamingSections: new Map<string, StreamingSection>(),
  error: null,
  activeSubThreadSectionId: null,
  activeSubThreadPreview: null,
};

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [
        conversation,
        ...state.conversations.filter((c) => c.id !== conversation.id),
      ],
    })),

  setActiveConversationId: (id) => set({ activeConversationId: id }),

  setMessages: (messages) => set({ messages }),

  addUserMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  startStreaming: (messageId) =>
    set({
      streamingMessageId: messageId,
      streamingSections: new Map(),
      error: null,
    }),

  appendStreamingSection: (sectionId, type, order, title) =>
    set((state) => {
      const next = new Map(state.streamingSections);
      next.set(sectionId, { id: sectionId, type, order, title, content: "" });
      return { streamingSections: next };
    }),

  appendStreamingDelta: (sectionId, content) =>
    set((state) => {
      const section = state.streamingSections.get(sectionId);
      if (!section) return state;
      const next = new Map(state.streamingSections);
      next.set(sectionId, { ...section, content: section.content + content });
      return { streamingSections: next };
    }),

  finishStreaming: (messageId, sections) =>
    set((state) => {
      const sorted = [...sections].sort((a, b) => a.order - b.order);
      const assistantMessage: MessageWithSections = {
        id: messageId,
        conversationId: state.activeConversationId ?? "",
        role: "assistant",
        content: sorted
          .map((s) => (s.title ? s.title + "\n\n" + s.content : s.content))
          .join("\n\n"),
        tokenCountIn: null,
        tokenCountOut: null,
        createdAt: new Date(),
        sections: sorted.map((s, i) => ({
          id: s.id,
          messageId,
          type: s.type,
          title: s.title ?? undefined,
          content: s.content,
          order: i,
          createdAt: new Date(),
        })),
      };
      return {
        messages: [...state.messages, assistantMessage],
        streamingMessageId: null,
        streamingSections: new Map(),
        error: null,
      };
    }),

  setStreamingError: (error) =>
    set({ error, streamingMessageId: null, streamingSections: new Map() }),

  setConversationTitle: (conversationId, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, title } : c,
      ),
    })),

  removeConversation: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
      activeConversationId:
        state.activeConversationId === conversationId
          ? null
          : state.activeConversationId,
      messages:
        state.activeConversationId === conversationId ? [] : state.messages,
    })),

  reset: () => set(initialState),

  activeSubThreadSectionId: null,
  activeSubThreadPreview: null,
  openSubThread: (sectionId, preview) =>
    set({
      activeSubThreadSectionId: sectionId,
      activeSubThreadPreview: preview,
    }),
  closeSubThread: () =>
    set({ activeSubThreadSectionId: null, activeSubThreadPreview: null }),
}));
