"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { CodeBlock } from "@/components/chat/code-block";
import { CopyButton } from "@/components/chat/copy-button";
import { cn } from "@/lib/utils";
import type { SectionType } from "@/lib/types";

interface SectionCardProps {
  type: SectionType;
  title?: string;
  content: string;
  sectionId?: string;
  threadCount?: number;
  isThreadOrigin?: boolean;
  onOpenThread?: (sectionId: string, content: string, type: SectionType) => void;
}

export function SectionCard({
  type,
  title,
  content,
  sectionId,
  threadCount = 0,
  isThreadOrigin = false,
  onOpenThread,
}: SectionCardProps) {
  const showThread = sectionId && onOpenThread;
  const fullContent = title ? title + "\n\n" + content : content;
  const wrap = (inner: React.ReactNode) => (
    <div
      className={cn(
        "group flex flex-col rounded-md transition-colors",
        isThreadOrigin && "bg-primary/5 p-4 ring-2 ring-primary/60",
      )}
    >
      <div className="min-w-0">{inner}</div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 border-t border-border/50 pt-2">
        <CopyButton
          text={fullContent}
          label="Copy section"
          size="icon"
          className="h-10 w-10 shrink-0 lg:h-9 lg:w-9 lg:px-2"
        />
        {showThread && (
          <>
            {threadCount > 0 && (
              <Badge
                variant="secondary"
                className="text-xs"
                title={`${threadCount} message${threadCount === 1 ? "" : "s"} in thread`}
              >
                {threadCount}
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 min-h-10 shrink-0 gap-1 px-3 text-muted-foreground hover:text-foreground lg:h-7 lg:min-h-0 lg:px-2"
              onClick={() => onOpenThread(sectionId, fullContent, type)}
            >
              <MessageSquare className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
              Reply
            </Button>
          </>
        )}
      </div>
    </div>
  );

  if (type === "code") {
    return wrap(
      <div className="overflow-hidden rounded-md border bg-muted/50 font-mono text-sm">
        <CodeBlock content={content} />
      </div>
    );
  }

  if (type === "list") {
    const lines = content.split(/\n/).filter(Boolean);
    return wrap(
      <ul className="list-inside list-disc space-y-0.5 py-0.5 text-sm">
        {lines.map((line, i) => (
          <li key={i}>{line.replace(/^[-*]\s*/, "")}</li>
        ))}
      </ul>
    );
  }

  if (type === "heading" && !title) {
    const [first, ...rest] = content.split(/\n/);
    return wrap(
      <div className="py-0.5">
        <h3 className="text-sm font-semibold">{first}</h3>
        {rest.length > 0 && (
          <p className="mt-0.5 text-sm text-muted-foreground whitespace-pre-wrap">{rest.join("\n")}</p>
        )}
      </div>
    );
  }
  if (title) {
    return wrap(
      <div className="py-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {content ? (
          <p className="mt-0.5 text-sm text-muted-foreground whitespace-pre-wrap">{content}</p>
        ) : null}
      </div>
    );
  }
  if (type === "heading") {
    return wrap(
      <div className="py-0.5">
        <h3 className="text-sm font-semibold">{content}</h3>
      </div>
    );
  }

  if (type === "quote") {
    return wrap(
      <blockquote className="border-l-2 border-muted-foreground/30 py-0.5 pl-3 text-sm italic text-muted-foreground">
        {content}
      </blockquote>
    );
  }

  if (type === "table") {
    const rows = content.split(/\n/).filter(Boolean);
    return wrap(
      <div className="overflow-x-auto py-0.5">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                {row.split(/\t|\\t/).map((cell, j) => (
                  <td key={j} className="py-1 pr-2">
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return wrap(
    <p className="whitespace-pre-wrap py-0.5 text-sm leading-relaxed">{content}</p>
  );
}
