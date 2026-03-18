"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  error?: string;
  onClearError?: () => void;
}

export function MessageInput({
  onSend,
  disabled,
  error,
  onClearError,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="relative">
      {error && (
        <div className="absolute bottom-full left-0 right-0 flex items-center justify-between gap-2 p-2 text-sm text-destructive">
          <span>{error}</span>
          {onClearError && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearError}
            >
              Dismiss
            </Button>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-4">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type a message..."
          disabled={disabled}
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || !value.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
