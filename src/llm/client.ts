export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  params: Record<string, unknown> | null;
  offline?: boolean;
}

export async function sendChat(
  messages: ChatMessage[],
  context: unknown
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur réseau" }));
    throw new Error(err.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export async function checkHealth(): Promise<{ llm: boolean; model: string }> {
  try {
    const res = await fetch("/api/health");
    return await res.json();
  } catch {
    return { llm: false, model: "" };
  }
}
