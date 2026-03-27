"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TEXTAREA_MAX_PX = 200;

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  error?: string;
  onClearError?: () => void;
  isStreaming?: boolean;
  onStop?: () => void;
  /** When `key` changes, replaces composer text and focuses (e.g. starter prompts). */
  injectText?: { key: number; text: string } | null;
  onInjectConsumed?: () => void;
}

export function MessageInput({
  onSend,
  disabled,
  error,
  onClearError,
  isStreaming,
  onStop,
  injectText,
  onInjectConsumed,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, TEXTAREA_MAX_PX)}px`;
  }, []);

  useEffect(() => {
    if (error) textareaRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!injectText) return;
    setText(injectText.text);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      resizeTextarea();
      onInjectConsumed?.();
    });
  }, [injectText, onInjectConsumed, resizeTextarea]);

  useEffect(() => {
    resizeTextarea();
  }, [text, resizeTextarea]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-4">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            {onClearError && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/50"
                onClick={onClearError}
              >
                Dismiss
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            requestAnimationFrame(resizeTextarea);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Shift+Enter for newline)"
          disabled={disabled}
          rows={1}
          className="min-h-11 max-h-[200px] resize-none overflow-y-auto text-base sm:min-h-10 sm:text-sm"
          aria-label="Message"
        />
        {isStreaming && onStop ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onStop}
            className="h-11 min-w-11 shrink-0 self-end px-4 sm:h-10"
          >
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={disabled || !text.trim()}
            className="h-11 min-w-11 shrink-0 self-end px-4 sm:h-10"
          >
            Send
          </Button>
        )}
      </form>
    </div>
  );
}
