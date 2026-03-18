"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
}

export function CopyButton({
  text,
  className,
  size = "sm",
  label = "Copy",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!text.trim()) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    });
  }, [text]);

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={`gap-1 px-2 text-muted-foreground hover:text-foreground ${className ?? ""}`}
      onClick={handleCopy}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
