"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useChatStore } from "@/stores/chat";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { SubThreadPanel } from "@/components/chat/sub-thread-panel";
import { useSSEStream } from "@/hooks/use-sse-stream";

export default function ChatIdPage() {
  const params = useParams();
  const id = params.id as string;
  const prevIdRef = useRef<string | null>(null);

  const {
    activeConversationId,
    setActiveConversationId,
    openSubThread,
    setStreamingError,
    messages,
    setMessages,
    setConversations,
    streamingMessageId,
    streamingSections,
  } = useChatStore();

  const { send, isStreaming, isWaitingForResponse, error } = useSSEStream({ conversationId: id });

  useEffect(() => {
    setActiveConversationId(id);
  }, [id, setActiveConversationId]);

  useEffect(() => {
    if (!id) return;

    // Only clear when switching from one conversation to another (not on first mount from /chat).
    // This keeps the optimistic first message visible until the fetch resolves.
    if (prevIdRef.current != null && prevIdRef.current !== id) {
      setMessages([]);
    }
    prevIdRef.current = id;

    fetch(`/api/conversations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const serverMessages = data.messages ?? [];
        // Don't overwrite with [] while we're streaming the first message (just navigated from /chat)
        const { messages: currentMessages, streamingMessageId } =
          useChatStore.getState();
        const keepOptimistic =
          serverMessages.length === 0 &&
          streamingMessageId != null &&
          currentMessages.length > 0 &&
          currentMessages.some((m) => m.conversationId === id);
        if (!keepOptimistic) {
          setMessages(serverMessages);
        }
      })
      .catch(() => setMessages([]));
  }, [id, setMessages]);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(setConversations)
      .catch(() => setConversations([]));
  }, [setConversations]);

  const displayMessages = messages;
  const displayStreamingId =
    activeConversationId === id ? streamingMessageId : null;
  const displayStreamingSections =
    activeConversationId === id ? streamingSections : new Map();
  const displayWaitingForResponse =
    activeConversationId === id ? isWaitingForResponse : false;

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MessageList
            messages={displayMessages}
            streamingMessageId={displayStreamingId}
            streamingSections={displayStreamingSections}
            isWaitingForResponse={displayWaitingForResponse}
            onOpenThread={(id, content, type) =>
              openSubThread(id, { content, type })
            }
          />
          <MessageInput
            onSend={send}
            disabled={isStreaming}
            error={error ?? undefined}
            onClearError={() => setStreamingError(null)}
          />
        </main>
        <SubThreadPanel />
      </div>
    </div>
  );
}
