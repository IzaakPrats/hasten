"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

interface CodeBlockProps {
  content: string;
}

function extractLangAndCode(raw: string): { lang: string; code: string } {
  const match = raw.match(/^```(\w*)\n?([\s\S]*?)```$/m);
  if (match) {
    return { lang: match[1] || "text", code: match[2].trimEnd() };
  }
  return { lang: "text", code: raw.trimEnd() };
}

export function CodeBlock({ content }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const { lang, code } = extractLangAndCode(content);
  const supportedLangs = [
    "typescript",
    "javascript",
    "json",
    "yaml",
    "bash",
    "python",
    "html",
    "css",
    "markdown",
    "plaintext",
  ];
  const langId = lang && supportedLangs.includes(lang) ? lang : "plaintext";

  useEffect(() => {
    let cancelled = false;
    import("shiki").then(({ createHighlighter }) => {
      createHighlighter({
        themes: ["github-dark"],
        langs: supportedLangs as (
          | "typescript"
          | "javascript"
          | "json"
          | "yaml"
          | "bash"
          | "python"
          | "html"
          | "css"
          | "markdown"
          | "plaintext"
        )[],
      })
        .then((highlighter) => {
          if (cancelled) return;
          try {
            const out = highlighter.codeToHtml(code, {
              lang: langId,
              theme: "github-dark",
            });
            setHtml(out);
          } catch {
            setHtml(null);
          }
        })
        .catch(() => setHtml(null));
    });
    return () => {
      cancelled = true;
    };
  }, [code, langId]);

  const copy = () => {
    void navigator.clipboard.writeText(code);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 opacity-70 hover:opacity-100"
        onClick={copy}
      >
        <Copy className="h-4 w-4" />
      </Button>
      <div className="overflow-x-auto rounded-md bg-[#0d1117] p-3 text-sm">
        {html ? (
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            className="shiki-code [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-0"
          />
        ) : (
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-gray-300">
            {code}
          </pre>
        )}
      </div>
    </div>
  );
}
