"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/chat/section-card";
import { MessageInput } from "@/components/chat/message-input";
import { CopyButton } from "@/components/chat/copy-button";
import { useChatStore } from "@/stores/chat";
import { cn } from "@/lib/utils";
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
  const abortRef = useRef<AbortController | null>(null);

  const stopThreadStream = useCallback(() => {
    abortRef.current?.abort();
    setStreamingSections((sections) => {
      const sorted = Array.from(sections.values()).sort((a, b) => a.order - b.order);
      if (sorted.length > 0) {
        const fullContent = sorted
          .map((s) => (s.title ? s.title + "\n\n" + s.content : s.content))
          .join("\n\n");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: fullContent,
            createdAt: new Date(),
          },
        ]);
      }
      return new Map();
    });
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingSections, isStreaming]);

  const loadOrCreateThread = useCallback(async (sectionId: string) => {
    setError(null);
    try {
      const listRes = await fetch(`/api/sections/${sectionId}/threads`);
      if (!listRes.ok) {
        const err = await listRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed to load threads (${listRes.status})`);
      }
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
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error || `Failed to create thread (${createRes.status})`);
        }
        const created = await createRes.json();
        id = created.id;
      }
      setThreadId(id);
      const msgRes = await fetch(`/api/threads/${id}/messages`);
      if (!msgRes.ok) {
        const err = await msgRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Failed to load messages (${msgRes.status})`);
      }
      const msgs = await msgRes.json();
      setMessages(
        msgs.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        }))
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load thread";
      setError(message);
      setThreadId(null);
      setMessages([]);
    }
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

      const ac = new AbortController();
      const { signal } = ac;
      abortRef.current = ac;

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
          signal,
        });
        if (!res.ok) {
          if (!signal.aborted) {
            const err = await res.json().catch(() => ({}));
            setError((err as { error?: string }).error || "Failed to send");
            setMessages((prev) => prev.slice(0, -1));
          }
          return;
        }
        const reader = res.body?.getReader();
        if (!reader) {
          if (!signal.aborted) {
            setError("No response body");
            setMessages((prev) => prev.slice(0, -1));
          }
          return;
        }
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          let readResult: ReadableStreamReadResult<Uint8Array>;
          try {
            readResult = await reader.read();
          } catch {
            if (signal.aborted) break;
            throw new Error("Stream read failed");
          }
          const { done, value } = readResult;
          if (done) break;
          if (signal.aborted) break;
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
              if (signal.aborted) break;
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
              if (!signal.aborted) {
                setError(data.error as string);
              }
            }
          }
        }
      } catch (e) {
        if (
          signal.aborted ||
          (e instanceof DOMException && e.name === "AbortError")
        ) {
          return;
        }
        setError(e instanceof Error ? e.message : "Stream error");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [threadId, isStreaming]
  );

  if (!activeSectionId) return null;

  return (
    <div
      className={cn(
        "z-40 flex w-full max-w-none flex-shrink-0 flex-col bg-background lg:relative lg:z-auto lg:max-w-md lg:border-l lg:bg-muted/30",
        "fixed inset-0 max-h-[100dvh] lg:static lg:inset-auto lg:max-h-none",
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <span className="min-w-0 truncate text-sm font-medium" title={activePreview?.content}>
          {activePreview
            ? activePreview.content.trim().slice(0, 48) +
              (activePreview.content.length > 48 ? "…" : "")
            : "Thread"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0 lg:h-8 lg:w-8 lg:border-transparent lg:bg-transparent lg:shadow-none lg:hover:bg-accent"
          onClick={closeSubThread}
        >
          <X className="h-5 w-5 lg:h-4 lg:w-4" />
          <span className="sr-only">Close thread</span>
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-3"
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
          {!threadId && !error && (
            <div className="flex justify-center py-4 text-sm text-muted-foreground">
              Starting thread…
            </div>
          )}
          {!threadId && error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className="space-y-1">
              {m.role === "user" ? (
                <div className="group ml-auto flex max-w-[85%] flex-col items-end gap-1">
                  <div className="rounded-lg bg-muted px-2 py-1.5 text-sm">
                    {m.content}
                  </div>
                  <div className="hidden justify-end opacity-70 max-lg:flex lg:group-hover:flex lg:group-focus-within:flex">
                    <CopyButton
                      text={m.content}
                      size="icon"
                      className="h-10 w-10 lg:h-6 lg:w-6"
                      label="Copy message"
                    />
                  </div>
                </div>
              ) : (
                <div className="group flex max-w-[85%] flex-col gap-1">
                  <div className="space-y-2">
                    {m.content
                      .split(/\n\n/)
                      .filter((p) => p.trim())
                      .map((para, i) => (
                        <p key={i} className="whitespace-pre-wrap text-sm">
                          {para}
                        </p>
                      ))}
                  </div>
                  <div className="hidden justify-end opacity-70 max-lg:flex lg:group-hover:flex lg:group-focus-within:flex">
                    <CopyButton
                      text={m.content}
                      size="icon"
                      className="h-10 w-10 lg:h-6 lg:w-6"
                      label="Copy response"
                    />
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
                <span>Thinking…</span>
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
          isStreaming={isStreaming}
          onStop={stopThreadStream}
          error={error ?? undefined}
          onClearError={() => setError(null)}
        />
      </div>
    </div>
  );
}
