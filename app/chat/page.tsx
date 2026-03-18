"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chat";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { SubThreadPanel } from "@/components/chat/sub-thread-panel";
import { useSSEStream } from "@/hooks/use-sse-stream";

export default function ChatPage() {
  const router = useRouter();
  const setActiveConversationId = useChatStore(
    (s) => s.setActiveConversationId,
  );
  const openSubThread = useChatStore((s) => s.openSubThread);
  const messages = useChatStore((s) => s.messages);
  const streamingMessageId = useChatStore((s) => s.streamingMessageId);
  const streamingSections = useChatStore((s) => s.streamingSections);

  const setConversations = useChatStore((s) => s.setConversations);
  const setMessages = useChatStore((s) => s.setMessages);

  // Clear when landing on new-chat page so we don't show another conversation's messages
  useEffect(() => {
    setActiveConversationId(null);
    setMessages([]);
  }, [setActiveConversationId, setMessages]);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then(setConversations)
      .catch(() => setConversations([]));
  }, [setConversations]);

  const setStreamingError = useChatStore((s) => s.setStreamingError);
  const { send, isStreaming, isWaitingForResponse, error } = useSSEStream({
    conversationId: "",
    onCreated: (id) => {
      setActiveConversationId(id);
      router.replace(`/chat/${id}`);
    },
  });

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MessageList
            messages={messages}
            streamingMessageId={streamingMessageId}
            streamingSections={streamingSections}
            isWaitingForResponse={isWaitingForResponse}
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
