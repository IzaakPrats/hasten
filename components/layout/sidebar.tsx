"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const activeId = params.id as string | undefined;
  const conversations = useChatStore((s) => s.conversations);
  const setConversationTitle = useChatStore((s) => s.setConversationTitle);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const setMessages = useChatStore((s) => s.setMessages);
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      setEditValue(
        conversations.find((c) => c.id === editingId)?.title ||
          "New conversation",
      );
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId, conversations]);

  const handleRename = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(id);
  };

  const saveRename = async (id: string) => {
    const value = editValue.trim() || "New conversation";
    setEditingId(null);
    setConversationTitle(id, value);
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
    } catch {
      // revert on failure
      const conv = conversations.find((c) => c.id === id);
      if (conv) setConversationTitle(id, conv.title ?? "New conversation");
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveRename(id);
    } else if (e.key === "Escape") {
      setEditingId(null);
      editInputRef.current?.blur();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      removeConversation(id);
      if (pathname === `/chat/${id}`) {
        router.push("/chat");
      }
    } catch {
      // ignore
    }
  };

  return (
    <aside className="flex w-56 flex-col border-r bg-muted/30">
      <div className="p-2">
        <Button asChild variant="default" size="sm" className="w-full">
          <Link
            href="/chat"
            onClick={(e) => {
              if (pathname === "/chat") {
                e.preventDefault();
                setActiveConversationId(null);
                setMessages([]);
              }
            }}
          >
            New Chat
          </Link>
        </Button>
      </div>
      <ScrollArea className="flex-1 min-w-0">
        <ul className="space-y-0.5 p-2 pr-12">
          {conversations.map((c) => {
            const isActive = pathname === `/chat/${c.id}`;
            const isEditing = editingId === c.id;
            const rowClass = cn(
              "flex items-center gap-1 rounded-md px-3 py-2 text-sm hover:bg-accent",
              isActive ? "bg-accent" : "",
            );
            return (
              <li key={c.id} className="group relative">
                {isEditing ? (
                  <div className={rowClass}>
                    <Input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveRename(c.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, c.id)}
                      className="h-8 flex-1 min-w-0 text-sm"
                      aria-label="Rename conversation"
                    />
                  </div>
                ) : (
                  <Link
                    href={`/chat/${c.id}`}
                    className={cn(rowClass, "relative overflow-hidden")}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {c.title || "New conversation"}
                    </span>
                    {/* Gradient overlay: fades row into the edge; icons sit on top */}
                    <div
                      aria-hidden
                      className="absolute inset-y-0 right-0 w-16 shrink-0 bg-gradient-to-r from-transparent to-muted/30 pointer-events-none transition-opacity group-hover:opacity-0"
                      style={{ opacity: isActive ? 0 : 1 }}
                    />
                    <div
                      aria-hidden
                      className="absolute inset-y-0 right-0 w-16 shrink-0 bg-gradient-to-r from-transparent to-accent pointer-events-none opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ opacity: isActive ? 1 : undefined }}
                    />
                    <div className="relative z-10 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => handleRename(e, c.id)}
                        aria-label="Rename"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, c.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </aside>
  );
}
