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

  // #region agent log
  fetch("http://127.0.0.1:7252/ingest/0d67d51d-f9c8-4683-b59e-711f580f6b30", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "api/sections/[sectionId]/threads/route.ts:POST",
      message: "POST create started",
      data: { sectionId },
      timestamp: Date.now(),
      hypothesisId: "H3",
    }),
  }).catch(() => {});
  // #endregion

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
    // #region agent log
    fetch("http://127.0.0.1:7252/ingest/0d67d51d-f9c8-4683-b59e-711f580f6b30", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/sections/[sectionId]/threads/route.ts:section",
        message: "section not found",
        data: { sectionId },
        timestamp: Date.now(),
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const conversationId = section.message.conversationId;
  const messageId = section.messageId;

  let parentSummary = "";
  try {
    const existing = await db.subThread.findFirst({
      where: { sectionId },
      select: { parentSummary: true },
    });
    if (existing?.parentSummary) {
      parentSummary = existing.parentSummary;
    } else {
      parentSummary = await generateParentSummary(conversationId, messageId);
    }
  } catch (err) {
    // #region agent log
    fetch("http://127.0.0.1:7252/ingest/0d67d51d-f9c8-4683-b59e-711f580f6b30", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location:
          "api/sections/[sectionId]/threads/route.ts:generateParentSummary",
        message: "generateParentSummary threw",
        data: { error: err instanceof Error ? err.message : String(err) },
        timestamp: Date.now(),
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate summary",
      },
      { status: 500 },
    );
  }

  const thread = await db.subThread.create({
    data: {
      sectionId,
      parentSummary: parentSummary || null,
    },
  });

  // #region agent log
  fetch("http://127.0.0.1:7252/ingest/0d67d51d-f9c8-4683-b59e-711f580f6b30", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "api/sections/[sectionId]/threads/route.ts:created",
      message: "subThread created",
      data: { threadId: thread.id },
      timestamp: Date.now(),
      hypothesisId: "H3",
    }),
  }).catch(() => {});
  // #endregion
  return NextResponse.json(thread);
}
