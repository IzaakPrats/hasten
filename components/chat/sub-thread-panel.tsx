"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/chat/section-card";
import { MessageInput } from "@/components/chat/message-input";
import { CopyButton } from "@/components/chat/copy-button";
import { useChatStore } from "@/stores/chat";
import { X } from "lucide-react";
import type { SectionType } from "@/lib/types";

interface SubThreadMessage {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

interface StreamingSection {
  id: string;
  type: SectionType;
  order: number;
  title?: string;
  content: string;
}

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
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}

export function SubThreadPanel() {
  const activeSectionId = useChatStore((s) => s.activeSubThreadSectionId);
  const activePreview = useChatStore((s) => s.activeSubThreadPreview);
  const closeSubThread = useChatStore((s) => s.closeSubThread);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SubThreadMessage[]>([]);
  const [streamingSections, setStreamingSections] = useState<
    Map<string, StreamingSection>
  >(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingSections, isStreaming]);

  const loadOrCreateThread = useCallback(async (sectionId: string) => {
    const listRes = await fetch(`/api/sections/${sectionId}/threads`);
    const threads = await listRes.json();
    let id: string;
    if (threads.length > 0) {
      id = threads[0].id;
    } else {
      const createRes = await fetch(`/api/sections/${sectionId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const created = await createRes.json();
      id = created.id;
    }
    setThreadId(id);
    const msgRes = await fetch(`/api/threads/${id}/messages`);
    const msgs = await msgRes.json();
    setMessages(
      msgs.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
        ...m,
        createdAt: new Date(m.createdAt),
      }))
    );
  }, []);

  useEffect(() => {
    if (activeSectionId) {
      loadOrCreateThread(activeSectionId);
    } else {
      setThreadId(null);
      setMessages([]);
    }
  }, [activeSectionId, loadOrCreateThread]);

  const send = useCallback(
    async (content: string) => {
      if (!threadId || !content.trim() || isStreaming) return;

      setError(null);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content,
          createdAt: new Date(),
        },
      ]);
      setIsStreaming(true);
      setStreamingSections(new Map());

      const sectionMeta = new Map<string, { type: SectionType; order: number; title?: string }>();
      const sectionContent = new Map<string, string>();
      const sections: { id: string; type: SectionType; title?: string; content: string; order: number }[] = [];

      try {
        const res = await fetch(`/api/threads/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setError(err.error || "Failed to send");
          setMessages((prev) => prev.slice(0, -1));
          setIsStreaming(false);
          return;
        }
        const reader = res.body?.getReader();
        if (!reader) {
          setError("No response body");
          setMessages((prev) => prev.slice(0, -1));
          setIsStreaming(false);
          return;
        }
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
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
              const title = typeof data.title === "string" ? data.title : undefined;
              setStreamingSections((prev) => {
                const next = new Map(prev);
                next.set(data.sectionId as string, {
                  id: data.sectionId as string,
                  type: data.type as SectionType,
                  order: data.order as number,
                  title,
                  content: "",
                });
                return next;
              });
              sectionMeta.set(data.sectionId as string, {
                type: data.type as SectionType,
                order: data.order as number,
                title,
              });
              sectionContent.set(data.sectionId as string, "");
            } else if (event === "delta" && data.sectionId && data.content) {
              setStreamingSections((prev) => {
                const s = prev.get(data.sectionId as string);
                if (!s) return prev;
                const next = new Map(prev);
                next.set(data.sectionId as string, {
                  ...s,
                  content: s.content + (data.content as string),
                });
                return next;
              });
              const prev = sectionContent.get(data.sectionId as string) ?? "";
              sectionContent.set(data.sectionId as string, prev + (data.content as string));
            } else if (event === "section_end" && data.sectionId) {
              const sid = data.sectionId as string;
              const meta = sectionMeta.get(sid);
              if (meta) {
                sections.push({
                  id: sid,
                  type: meta.type,
                  title: meta.title,
                  content: sectionContent.get(sid) ?? "",
                  order: meta.order,
                });
              }
            } else if (event === "done") {
              const fullContent = sections
                .sort((a, b) => a.order - b.order)
                .map((s) => (s.title ? s.title + "\n\n" + s.content : s.content))
                .join("\n\n");
              setMessages((prev) => [
                ...prev,
                {
                  id: (data.messageId as string) ?? crypto.randomUUID(),
                  role: "assistant",
                  content: fullContent,
                  createdAt: new Date(),
                },
              ]);
              setStreamingSections(new Map());
            } else if (event === "error" && data.error) {
              setError(data.error as string);
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Stream error");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsStreaming(false);
      }
    },
    [threadId, isStreaming]
  );

  if (!activeSectionId) return null;

  return (
    <div className="flex w-full max-w-md flex-shrink-0 flex-col border-l bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Thread</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={closeSubThread}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close thread</span>
        </Button>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto p-3"
        >
          {activePreview && (
            <div className="rounded-md border bg-background p-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Reply to:
              </p>
              <SectionCard
                type={activePreview.type}
                content={activePreview.content}
              />
            </div>
          )}
          {!threadId && (
            <div className="flex justify-center py-4 text-sm text-muted-foreground">
              Loading thread...
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="space-y-1">
              {m.role === "user" ? (
                <div className="group relative ml-auto max-w-[85%]">
                  <div className="rounded-lg bg-muted px-2 py-1.5 text-sm pr-9">
                    {m.content}
                  </div>
                  <div className="absolute right-1 top-1 opacity-70 group-hover:opacity-100">
                    <CopyButton text={m.content} size="icon" className="h-6 w-6" label="Copy message" />
                  </div>
                </div>
              ) : (
                <div className="group relative max-w-[85%] flex flex-col gap-1">
                  <div className="absolute right-0 top-0 z-10 opacity-70 group-hover:opacity-100">
                    <CopyButton text={m.content} size="icon" className="h-6 w-6" label="Copy full response" />
                  </div>
                  <div className="pt-6 space-y-1">
                    {m.content.split(/\n\n/).map((para, i) => (
                      <div key={i} className="group/para relative">
                        <p className="text-sm pr-8">
                          {para}
                        </p>
                        <div className="absolute right-0 top-0 opacity-70 group-hover/para:opacity-100">
                          <CopyButton text={para} size="icon" className="h-5 w-5" label="Copy paragraph" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {isStreaming && streamingSections.size === 0 && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                <span className="inline-flex gap-0.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
                </span>
                <span>Thinking...</span>
              </div>
            </div>
          )}
          {Array.from(streamingSections.values())
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <SectionCard key={s.id} type={s.type} title={s.title} content={s.content} />
            ))}
        </div>
        <MessageInput
          onSend={send}
          disabled={isStreaming || !threadId}
          error={error ?? undefined}
          onClearError={() => setError(null)}
        />
      </div>
    </div>
  );
}
