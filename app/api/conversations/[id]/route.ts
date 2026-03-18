import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: {
              _count: { select: { threads: true } },
              threads: {
                take: 1,
                include: { _count: { select: { messages: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(conversation);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const data: { title?: string; model?: string } = {};
  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.model === "string") data.model = body.model;
  const conversation = await db.conversation
    .update({
      where: { id },
      data,
    })
    .catch(() => null);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(conversation);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.conversation.delete({ where: { id } }).catch(() => null);
  return new NextResponse(null, { status: 204 });
}
