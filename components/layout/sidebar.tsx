"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chat";
import { useIsLg } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function SidebarInner({ onRequestClose }: { onRequestClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const conversations = useChatStore((s) => s.conversations);
  const setConversationTitle = useChatStore((s) => s.setConversationTitle);
  const removeConversation = useChatStore((s) => s.removeConversation);
  const setMessages = useChatStore((s) => s.setMessages);
  const setActiveConversationId = useChatStore(
    (s) => s.setActiveConversationId,
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title || "New conversation").toLowerCase().includes(q),
    );
  }, [conversations, search]);

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

  const requestDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget({ id, title: title || "New conversation" });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      removeConversation(id);
      setDeleteTarget(null);
      if (pathname === `/chat/${id}`) {
        router.push("/chat");
      }
    } catch {
      // ignore
    }
  };

  const afterNavigate = () => {
    onRequestClose?.();
  };

  return (
    <>
      <div className="px-4 pb-2 pt-5">
        <p className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Hasten
        </p>
        <Button
          asChild
          variant="default"
          size="sm"
          className="h-10 w-full lg:h-9"
        >
          <Link
            href="/chat"
            onClick={(e) => {
              if (pathname === "/chat") {
                e.preventDefault();
                setActiveConversationId(null);
                setMessages([]);
              }
              afterNavigate();
            }}
          >
            New Chat
          </Link>
        </Button>
        {conversations.length > 0 && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="h-10 border-zinc-200 bg-white pl-9 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 lg:h-9"
              aria-label="Search conversations"
            />
          </div>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="space-y-2 px-4 pb-4">
          {conversations.length === 0 && (
            <li className="rounded-lg border border-dashed border-zinc-300 bg-white/60 px-3 py-4 text-center text-sm text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900/40">
              No conversations yet. Start with{" "}
              <span className="text-foreground">New Chat</span>.
            </li>
          )}
          {conversations.length > 0 && filtered.length === 0 && (
            <li className="rounded-lg border border-dashed border-zinc-300 bg-white/60 px-3 py-4 text-center text-sm text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900/40">
              No chats match your search.
            </li>
          )}
          {filtered.map((c) => {
            const isActive = pathname === `/chat/${c.id}`;
            const isEditing = editingId === c.id;
            const rowClass = cn(
              "flex min-h-11 items-center gap-1 rounded-lg border px-3 py-2 text-sm text-zinc-950 shadow-sm transition-colors dark:text-zinc-950",
              isActive
                ? "border-zinc-300 bg-zinc-100"
                : "border-zinc-200/90 bg-white hover:bg-zinc-50",
            );
            const displayTitle = c.title || "New conversation";
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
                      className="h-10 min-w-0 flex-1 border-zinc-200 bg-white text-sm text-zinc-950 lg:h-8"
                      aria-label="Rename conversation"
                    />
                  </div>
                ) : (
                  <Link
                    href={`/chat/${c.id}`}
                    className={cn(rowClass, "group relative")}
                    onClick={afterNavigate}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {displayTitle}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5 max-lg:opacity-100 lg:pointer-events-none lg:opacity-0 lg:transition-opacity lg:duration-200 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-zinc-700 hover:bg-zinc-200/80 hover:text-zinc-950 lg:h-7 lg:w-7"
                        onClick={(e) => handleRename(e, c.id)}
                        aria-label="Rename"
                      >
                        <Pencil className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-zinc-600 hover:bg-zinc-200/80 hover:text-red-600 lg:h-7 lg:w-7"
                        onClick={(e) => requestDelete(e, c.id, displayTitle)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                      </Button>
                    </div>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function Sidebar() {
  const isLg = useIsLg();
  const isSidebarOpen = useChatStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);

  if (isLg) {
    return (
      <aside className="flex w-56 shrink-0 flex-col border-r bg-zinc-100 dark:bg-zinc-950">
        <SidebarInner />
      </aside>
    );
  }

  return (
    <Sheet open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent
        side="left"
        className="flex h-full max-h-[100dvh] w-[min(100vw-1rem,20rem)] max-w-[min(100vw-1rem,20rem)] flex-col gap-0 border-r bg-zinc-100 p-0 dark:bg-zinc-950"
      >
        <SheetTitle className="sr-only">Conversations</SheetTitle>
        <SidebarInner onRequestClose={() => setSidebarOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
