import { anthropic } from "./anthropic";

const TITLE_MODEL = "claude-3-5-haiku-20241022";

export async function generateConversationTitle(
  firstUserContent: string,
  firstAssistantContent: string,
): Promise<string> {
  const text = `User: ${firstUserContent.slice(0, 500)}\n\nAssistant: ${firstAssistantContent.slice(0, 800)}`;
  const response = await anthropic.messages.create({
    model: TITLE_MODEL,
    max_tokens: 30,
    messages: [
      {
        role: "user",
        content: `Generate a very short title (3-6 words) for this conversation. Reply with only the title, no quotes or punctuation.\n\n${text}`,
      },
    ],
  });
  const content = response.content.find((c) => c.type === "text");
  const raw = content && "text" in content ? content.text : "";
  return raw.trim().slice(0, 80) || "New conversation";
}

/** Generate a title from only the first user message (for parallel title + response). */
export async function generateConversationTitleFromUserMessage(
  firstUserContent: string,
): Promise<string> {
  const text = firstUserContent.slice(0, 500);
  const response = await anthropic.messages.create({
    model: TITLE_MODEL,
    max_tokens: 30,
    messages: [
      {
        role: "user",
        content: `Generate a very short title (3-6 words) for a conversation that starts with this message. Reply with only the title, no quotes or punctuation.\n\n${text}`,
      },
    ],
  });
  const content = response.content.find((c) => c.type === "text");
  const raw = content && "text" in content ? content.text : "";
  return raw.trim().slice(0, 80) || "New conversation";
}
