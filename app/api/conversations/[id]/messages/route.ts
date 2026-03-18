import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { streamConversationResponse, formatSSE } from "@/lib/stream";
import { generateConversationTitleFromUserMessage } from "@/lib/title";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const body = await request.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { sections: true } },
    },
  });
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const userMessage = await db.message.create({
    data: {
      conversationId,
      role: "user",
      content,
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const messagesForApi = [
    ...conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content },
  ];

  const encoder = new TextEncoder();
  const isFirstMessage = conversation.messages.length === 0;
  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };
      if (isFirstMessage) {
        generateConversationTitleFromUserMessage(content)
          .then(async (title) => {
            await db.conversation.update({
              where: { id: conversationId },
              data: { title },
            });
            write(formatSSE("title", { title }));
          })
          .catch(() => {});
      }
      try {
        await streamConversationResponse(
          {
            conversationId,
            model: conversation.model,
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
