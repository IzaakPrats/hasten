import { anthropic } from "./anthropic";
import { db } from "./db";

const SUMMARY_MODEL = "claude-sonnet-4-6";
const MAX_SUMMARY_TOKENS = 500;

export async function generateParentSummary(
  conversationId: string,
  upToMessageId: string,
): Promise<string> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
  });

  if (!conversation) return "";

  const idx = conversation.messages.findIndex((m) => m.id === upToMessageId);
  const messagesUpTo =
    idx >= 0 ? conversation.messages.slice(0, idx + 1) : conversation.messages;
  const truncated = messagesUpTo.slice(-20);
  const text = truncated
    .map((m) => `${m.role}: ${m.content.slice(0, 2000)}`)
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: MAX_SUMMARY_TOKENS,
    messages: [
      {
        role: "user",
        content: `Summarize the following conversation in about 300-500 words, preserving key facts and context. Focus on what the user asked and what was established. Use plain prose.\n\n${text}`,
      },
    ],
  });

  const content = response.content.find((c) => c.type === "text");
  return content && "text" in content ? content.text : "";
}
