import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { streamSubThreadResponse } from "@/lib/stream-subthread";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const messages = await db.subThreadMessage.findMany({
    where: { subThreadId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: subThreadId } = await params;
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const thread = await db.subThread.findUnique({
    where: { id: subThreadId },
    include: {
      section: { include: { message: { include: { conversation: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  await db.subThreadMessage.create({
    data: { subThreadId, role: "user", content },
  });

  const messagesForApi = [
    ...thread.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };
      try {
        await streamSubThreadResponse(
          {
            subThreadId,
            model: thread.section.message.conversation.model,
            parentSummary: thread.parentSummary ?? "",
            sectionContent: thread.section.title
              ? `${thread.section.title}\n\n${thread.section.content}`
              : thread.section.content,
            messages: messagesForApi,
          },
          write,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        write(
          `event: error\ndata: ${JSON.stringify({ error: message, code: "PROVIDER_ERROR" })}\n\n`,
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
