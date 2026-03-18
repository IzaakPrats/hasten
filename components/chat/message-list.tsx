"use client";

import { useEffect, useRef } from "react";
import { SectionCard } from "@/components/chat/section-card";
import { CopyButton } from "@/components/chat/copy-button";
import { useChatStore } from "@/stores/chat";
import type { MessageWithSections } from "@/stores/chat";
import type { StreamingSection } from "@/stores/chat";

interface MessageListProps {
  messages: MessageWithSections[];
  streamingMessageId: string | null;
  streamingSections: Map<string, StreamingSection>;
  onOpenThread?: (
    sectionId: string,
    content: string,
    type: import("@/lib/types").SectionType,
  ) => void;
}

export function MessageList({
  messages,
  streamingMessageId,
  streamingSections,
  onOpenThread,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSubThreadSectionId = useChatStore((s) => s.activeSubThreadSectionId);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamingSections]);

  const isEmpty = messages.length === 0 && !streamingMessageId;

  return (
    <div className="flex-1 overflow-y-auto" ref={scrollRef}>
      <div className="flex flex-col gap-4 p-4">
        {isEmpty && (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <p className="text-sm">Send a message to start the conversation.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="w-full max-w-[50%] space-y-2">
              {msg.role === "user" ? (
                <div className="group relative">
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm pr-10">
                    {msg.content}
                  </div>
                  <div className="absolute right-1 top-1 opacity-70 group-hover:opacity-100">
                    <CopyButton text={msg.content} size="icon" className="h-7 w-7" label="Copy message" />
                  </div>
                </div>
              ) : (
                <div className="group relative flex flex-col gap-0 space-y-1 pt-8">
                  <div className="absolute right-0 top-0 z-10 opacity-70 group-hover:opacity-100">
                    <CopyButton
                      text={msg.sections
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((s) => (s.title ? s.title + "\n\n" + s.content : s.content))
                        .join("\n\n")}
                      size="icon"
                      className="h-7 w-7"
                      label="Copy full response"
                    />
                  </div>
                  {msg.sections
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <SectionCard
                        key={s.id}
                        type={
                          s.type as
                            | "paragraph"
                            | "code"
                            | "list"
                            | "heading"
                            | "table"
                            | "quote"
                        }
                        title={s.title ?? undefined}
                        content={s.content}
                        sectionId={s.id}
                        threadCount={
                          s.threads?.[0]?._count?.messages ??
                          s._count?.threads ??
                          0
                        }
                        isThreadOrigin={s.id === activeSubThreadSectionId}
                        onOpenThread={
                          onOpenThread
                            ? (id, content, type) =>
                                onOpenThread(id, content, type)
                            : undefined
                        }
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {streamingMessageId && (
          <div className="flex flex-col items-start">
            <div className="group relative flex w-full max-w-[50%] flex-col gap-0 space-y-1 pt-8">
              {streamingSections.size > 0 && (
                <div className="absolute right-0 top-0 z-10 opacity-70 group-hover:opacity-100">
                  <CopyButton
                    text={Array.from(streamingSections.values())
                      .sort((a, b) => a.order - b.order)
                      .map((s) => (s.title ? s.title + "\n\n" + s.content : s.content))
                      .join("\n\n")}
                    size="icon"
                    className="h-7 w-7"
                    label="Copy response"
                  />
                </div>
              )}
              {streamingSections.size === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex gap-0.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
                  </span>
                  <span>Thinking</span>
                </div>
              ) : (
                Array.from(streamingSections.values())
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <SectionCard
                      key={s.id}
                      type={s.type}
                      title={s.title}
                      content={s.content}
                    />
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
