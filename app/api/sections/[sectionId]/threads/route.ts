import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateParentSummary } from "@/lib/summary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const { sectionId } = await params;
  const threads = await db.subThread.findMany({
    where: { sectionId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return NextResponse.json(threads);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const { sectionId } = await params;

  const section = await db.section.findUnique({
    where: { id: sectionId },
    include: {
      message: {
        include: {
          conversation: {
            include: {
              messages: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const conversationId = section.message.conversationId;
  const messageId = section.messageId;

  let parentSummary = "";
  const existing = await db.subThread.findFirst({
    where: { sectionId },
    select: { parentSummary: true },
  });
  if (existing?.parentSummary) {
    parentSummary = existing.parentSummary;
  } else {
    parentSummary = await generateParentSummary(conversationId, messageId);
  }

  const thread = await db.subThread.create({
    data: {
      sectionId,
      parentSummary: parentSummary || null,
    },
  });

  return NextResponse.json(thread);
}
