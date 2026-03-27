"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Menu, Monitor, Moon, Sun } from "lucide-react";

type HeaderProps = {
  activeConversationId?: string;
};

export function Header(props: HeaderProps = {}) {
  const { activeConversationId } = props;
  const { theme, setTheme } = useTheme();
  const isSidebarOpen = useChatStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const conversationTitle = useChatStore((s) => {
    if (!activeConversationId) return null;
    return (
      s.conversations.find((c) => c.id === activeConversationId)?.title ?? null
    );
  });
  const onMenuClick = () => setSidebarOpen(!isSidebarOpen);

  const headline =
    activeConversationId != null
      ? (conversationTitle?.trim() || "New conversation")
      : "Hasten";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-3 pt-[max(0px,env(safe-area-inset-top))] sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 lg:hidden"
          onClick={onMenuClick}
          aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="truncate font-semibold" title={headline}>
          {headline}
        </span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-11 w-11"
            aria-label="Theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          <DropdownMenuItem
            className="gap-2"
            onSelect={(e) => {
              e.preventDefault();
              setTheme("system");
            }}
          >
            <Monitor className="size-4 shrink-0" />
            <span className="flex-1">System</span>
            {theme === "system" ? (
              <Check className="size-4 shrink-0" aria-hidden />
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onSelect={(e) => {
              e.preventDefault();
              setTheme("light");
            }}
          >
            <Sun className="size-4 shrink-0" />
            <span className="flex-1">Light</span>
            {theme === "light" ? (
              <Check className="size-4 shrink-0" aria-hidden />
            ) : null}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onSelect={(e) => {
              e.preventDefault();
              setTheme("dark");
            }}
          >
            <Moon className="size-4 shrink-0" />
            <span className="flex-1">Dark</span>
            {theme === "dark" ? (
              <Check className="size-4 shrink-0" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
