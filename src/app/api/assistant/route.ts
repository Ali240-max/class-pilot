import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrganizerOrNull } from "@/lib/auth";
import { buildAssistantContext, SYSTEM_PROMPT } from "@/lib/ai/context";
import { aiChatStream, type ChatMessage } from "@/lib/ai/groq";
import { STREAM_CONTENT_TYPE, type AssistantJson, type StreamEvent } from "@/lib/ai/protocol";
import { sanitizeHistory } from "@/lib/ai/history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Past AI answers can exceed 2000 characters; sanitizeHistory trims them
// instead of rejecting the whole request.
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20_000),
      }),
    )
    .min(1)
    .max(30),
});

// Small per-organizer limit to protect the API key from runaway use.
// (Per server instance; good enough for a single-class app.)
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const organizer = await getOrganizerOrNull();
  if (!organizer) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const chatInput = sanitizeHistory(parsed.data.messages);
  if (!chatInput) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  if (rateLimited(organizer.userId)) {
    return NextResponse.json<AssistantJson>(
      { answer: null, facts: [], error: "You're asking very quickly. Wait a minute and try again." },
      { status: 429 },
    );
  }

  let context;
  try {
    // Facts come from the latest question only. The previous question is used
    // only when the latest is a bare follow-up with no topic of its own.
    context = await buildAssistantContext(organizer.supabase, chatInput.question, chatInput.previousQuestion);
  } catch (err) {
    console.error("Assistant context error", err);
    return NextResponse.json<AssistantJson>(
      { answer: null, facts: [], error: "Couldn't load your class data. Try again in a moment." },
      { status: 500 },
    );
  }

  if (!context.hasAnyData) {
    return NextResponse.json<AssistantJson>({
      answer: null,
      facts: [],
      notice:
        "There's no class data yet. Add courses, students and planner items (or load the demo data) and I'll be able to answer questions about them.",
    });
  }

  const chat: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `CLASS DATA (from the ClassPilot database, current as of now):\n${JSON.stringify(context.modelContext)}`,
    },
    ...chatInput.history,
    { role: "user", content: chatInput.question },
  ];

  const ai = await aiChatStream(chat);
  if (!ai.ok) {
    // Database facts are still useful even when the AI is unavailable.
    return NextResponse.json<AssistantJson>({ answer: null, facts: context.facts, error: ai.message });
  }

  // Stream the answer to the browser as it's generated: one JSON event per line.
  const encoder = new TextEncoder();
  const facts = context.facts;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      send({ type: "facts", facts });
      let wroteText = false;
      try {
        for await (const text of ai.chunks) {
          wroteText = true;
          send({ type: "delta", text });
        }
        if (wroteText) send({ type: "done" });
        else send({ type: "error", message: "The AI returned an empty answer. Try again." });
      } catch (err) {
        console.error("Groq stream error", err);
        send({ type: "error", message: "The AI's answer was cut off. Try asking again." });
      }
      controller.close();
    },
    cancel() {
      ai.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": STREAM_CONTENT_TYPE,
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
