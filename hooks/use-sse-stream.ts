"use client";

import { useCallback, useState } from "react";
import { useChatStore } from "@/stores/chat";
import type { SectionType } from "@/lib/types";

function parseSSEBlock(block: string): { event: string; data: unknown } | null {
  const lines = block.split("\n");
  let event = "";
  let dataLine = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLine = line.slice(5).trim();
  }
  if (!event || !dataLine) return null;
  try {
    const data = JSON.parse(dataLine);
    return { event, data };
  } catch {
    return null;
  }
}

export interface UseSSEStreamOptions {
  conversationId: string;
  onCreated?: (conversationId: string) => void;
}

export function useSSEStream(options: UseSSEStreamOptions) {
  const { conversationId, onCreated } = options;
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  const {
    addUserMessage,
    startStreaming,
    appendStreamingSection,
    appendStreamingDelta,
    finishStreaming,
    setStreamingError,
    setConversations,
    setConversationTitle,
    addConversation,
  } = useChatStore();

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      setIsWaitingForResponse(true);
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!createRes.ok) {
          setStreamingError("Failed to create conversation");
          setIsWaitingForResponse(false);
          return;
        }
        const conv = await createRes.json();
        activeConversationId = conv.id;
        addConversation({
          id: conv.id,
          title: conv.title ?? null,
          model: conv.model,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        });
        onCreated?.(activeConversationId);
      }

      const userMessage = {
        id: crypto.randomUUID(),
        conversationId: activeConversationId,
        role: "user",
        content,
        tokenCountIn: null,
        tokenCountOut: null,
        createdAt: new Date(),
        sections: [],
      };
      addUserMessage(userMessage);
      setIsStreaming(true);
      startStreaming("streaming");
      setIsWaitingForResponse(false);

      const res = await fetch(
        `/api/conversations/${activeConversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStreamingError(err.error || "Failed to send message");
        setIsStreaming(false);
        setIsWaitingForResponse(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setStreamingError("No response body");
        setIsStreaming(false);
        setIsWaitingForResponse(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      const sections: {
        id: string;
        type: SectionType;
        title?: string;
        content: string;
        order: number;
      }[] = [];
      const sectionContent: Map<string, string> = new Map();
      const sectionMeta: Map<
        string,
        { type: SectionType; order: number; title?: string }
      > = new Map();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const block of lines) {
            const parsed = parseSSEBlock(block);
            if (!parsed) continue;
            const { event, data } = parsed as {
              event: string;
              data: Record<string, unknown>;
            };

            if (
              event === "section_start" &&
              data.sectionId &&
              data.type &&
              typeof data.order === "number"
            ) {
              appendStreamingSection(
                data.sectionId as string,
                data.type as SectionType,
                data.order,
                typeof data.title === "string" ? data.title : undefined,
              );
              sectionContent.set(data.sectionId as string, "");
              sectionMeta.set(data.sectionId as string, {
                type: data.type as SectionType,
                order: data.order as number,
                title: typeof data.title === "string" ? data.title : undefined,
              });
            } else if (event === "delta" && data.sectionId && data.content) {
              appendStreamingDelta(
                data.sectionId as string,
                data.content as string,
              );
              const prev = sectionContent.get(data.sectionId as string) ?? "";
              sectionContent.set(
                data.sectionId as string,
                prev + (data.content as string),
              );
            } else if (event === "section_end" && data.sectionId) {
              const sid = data.sectionId as string;
              const content = sectionContent.get(sid) ?? "";
              const meta = sectionMeta.get(sid);
              if (meta) {
                sections.push({
                  id: sid,
                  type: meta.type,
                  title: meta.title,
                  content,
                  order: meta.order,
                });
              }
            } else if (event === "title" && typeof data.title === "string" && data.title.trim()) {
              setConversationTitle(activeConversationId, data.title.trim());
            } else if (event === "done" && data.messageId) {
              finishStreaming(data.messageId as string, sections);
              fetch("/api/conversations")
                .then((r) => r.json())
                .then(setConversations)
                .catch(() => {});
            } else if (event === "error" && data.error) {
              setStreamingError(data.error as string);
            }
          }
        }
      } catch (e) {
        setStreamingError(e instanceof Error ? e.message : "Stream error");
      } finally {
        setIsStreaming(false);
        setIsWaitingForResponse(false);
      }
    },
    [
      conversationId,
      isStreaming,
      onCreated,
      addUserMessage,
      startStreaming,
      appendStreamingSection,
      appendStreamingDelta,
      finishStreaming,
      setStreamingError,
      setConversations,
      setConversationTitle,
      addConversation,
    ],
  );

  const error = useChatStore((s) => s.error);

  return { send, isStreaming, isWaitingForResponse, error };
}
