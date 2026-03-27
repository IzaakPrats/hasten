"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SectionCard } from "@/components/chat/section-card";
import { CopyButton } from "@/components/chat/copy-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatStore } from "@/stores/chat";
import type { MessageWithSections } from "@/stores/chat";
import type { StreamingSection } from "@/stores/chat";
import { ArrowDown } from "lucide-react";

const NEAR_BOTTOM_PX = 160;

const STARTER_PROMPTS = [
  "Summarize the key points in a few bullets.",
  "Explain step by step with a short example.",
  "What tradeoffs should I consider?",
];

interface MessageListProps {
  messages: MessageWithSections[];
  streamingMessageId: string | null;
  streamingSections: Map<string, StreamingSection>;
  /** Show typing indicator while waiting for first response (e.g. creating conversation or before first chunk) */
  isWaitingForResponse?: boolean;
  /** Loading messages for the active conversation (e.g. initial fetch). */
  loading?: boolean;
  /** Fills the main composer when user picks a starter (parent wires to MessageInput). */
  onPickStarter?: (text: string) => void;
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
  isWaitingForResponse = false,
  loading = false,
  onPickStarter,
  onOpenThread,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSubThreadSectionId = useChatStore((s) => s.activeSubThreadSectionId);
  const prevMessageIdsRef = useRef<string[]>([]);
  const scrollUserMessageRef = useRef(false);
  const scrollAnchorRef = useRef(false);

  const [isNearBottom, setIsNearBottom] = useState(true);

  const measureNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setIsNearBottom(measureNearBottom());
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [measureNearBottom]);

  useEffect(() => {
    const ids = messages.map((m) => m.id);
    const prev = prevMessageIdsRef.current;
    const prevSet = new Set(prev);
    const last = messages[messages.length - 1];

    if (
      messages.length > prev.length &&
      last?.role === "user" &&
      (!prev.length || last.id !== prev[prev.length - 1])
    ) {
      scrollUserMessageRef.current = true;
    }

    const hasContent = messages.length > 0;
    const hadContent = prev.length > 0;
    if (
      hasContent &&
      (!hadContent || messages.every((m) => !prevSet.has(m.id)))
    ) {
      scrollAnchorRef.current = true;
    }

    prevMessageIdsRef.current = ids;
  }, [messages]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stick =
      scrollUserMessageRef.current ||
      scrollAnchorRef.current ||
      measureNearBottom();
    scrollUserMessageRef.current = false;
    scrollAnchorRef.current = false;
    if (stick) {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      setIsNearBottom(true);
    }
  }, [messages, streamingSections, isWaitingForResponse, measureNearBottom]);

  const showStreamingBlock = streamingMessageId != null || isWaitingForResponse;
  const isEmpty =
    !loading && messages.length === 0 && !showStreamingBlock;
  const showJumpToLatest =
    !isNearBottom && (messages.length > 0 || showStreamingBlock);

  return (
    <div className="relative min-h-0 flex-1">
      {showJumpToLatest && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 sm:bottom-4">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="pointer-events-auto shadow-md"
            onClick={() => {
              scrollToBottom("smooth");
              setIsNearBottom(true);
            }}
          >
            <ArrowDown className="mr-1.5 size-4" aria-hidden />
            Jump to latest
          </Button>
        </div>
      )}
      <div className="min-h-0 h-full overflow-y-auto" ref={scrollRef}>
        <div className="flex flex-col gap-4 p-3 sm:p-4">
        {loading && (
          <div className="flex flex-col gap-4 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <Skeleton
                  className={`h-14 rounded-lg ${i % 2 === 0 ? "w-[min(100%,20rem)]" : "w-[min(100%,14rem)]"}`}
                />
              </div>
            ))}
          </div>
        )}
        {isEmpty && (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center py-10 text-center sm:py-14">
            <p className="text-sm font-medium text-foreground">
              Start a conversation
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Replies are split into sections—use{" "}
              <span className="text-foreground">Reply</span> on any section to
              branch into a focused thread.
            </p>
            {onPickStarter && (
              <div className="mt-6 flex w-full flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Try a starter
                </p>
                <div className="flex flex-col gap-2">
                  {STARTER_PROMPTS.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto justify-start whitespace-normal px-3 py-2.5 text-left text-sm font-normal"
                      onClick={() => onPickStarter(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!loading &&
          messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="w-full max-w-[85%] space-y-2 lg:max-w-[50%]">
              {msg.role === "user" ? (
                <div className="group flex w-full flex-col items-end gap-1">
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    {msg.content}
                  </div>
                  <div className="hidden justify-end opacity-70 max-lg:flex lg:group-hover:flex lg:group-focus-within:flex">
                    <CopyButton
                      text={msg.content}
                      size="icon"
                      className="h-10 w-10 lg:h-7 lg:w-7"
                      label="Copy message"
                    />
                  </div>
                </div>
              ) : (
                <div className="group flex flex-col gap-0 space-y-1">
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
                  <div className="hidden justify-end opacity-70 max-lg:flex lg:group-hover:flex lg:group-focus-within:flex">
                    <CopyButton
                      text={msg.sections
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((s) => (s.title ? s.title + "\n\n" + s.content : s.content))
                        .join("\n\n")}
                      size="icon"
                      className="h-10 w-10 lg:h-7 lg:w-7"
                      label="Copy full response"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {!loading && showStreamingBlock && (
          <div className="flex flex-col items-start">
            <div className="group flex w-full max-w-[85%] flex-col gap-0 space-y-1 lg:max-w-[50%]">
              {streamingSections.size > 0 ? (
                <>
                  {Array.from(streamingSections.values())
                    .sort((a, b) => a.order - b.order)
                    .map((s) => (
                      <SectionCard
                        key={s.id}
                        type={s.type}
                        title={s.title}
                        content={s.content}
                      />
                    ))}
                  <div className="hidden justify-end opacity-70 max-lg:flex lg:group-hover:flex lg:group-focus-within:flex">
                    <CopyButton
                      text={Array.from(streamingSections.values())
                        .sort((a, b) => a.order - b.order)
                        .map((s) => (s.title ? s.title + "\n\n" + s.content : s.content))
                        .join("\n\n")}
                      size="icon"
                      className="h-10 w-10 lg:h-7 lg:w-7"
                      label="Copy response"
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex gap-0.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:0ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:200ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:400ms]" />
                  </span>
                  <span>
                    {streamingMessageId != null
                      ? "Thinking…"
                      : "Waiting for response…"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
