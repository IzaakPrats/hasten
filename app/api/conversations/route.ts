import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const conversations = await db.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      model: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(conversations);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const model = (body.model as string) || "claude-sonnet-4-6";
  const conversation = await db.conversation.create({
    data: { model },
  });
  return NextResponse.json(conversation);
}
