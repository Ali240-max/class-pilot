import "server-only";

// Server-only client for Groq's OpenAI-compatible Chat Completions API
// (https://console.groq.com). The key never leaves the server.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiError = {
  ok: false;
  reason: "not_configured" | "rate_limited" | "auth" | "provider" | "timeout";
  message: string;
};

export type AiStream = {
  ok: true;
  model: string;
  /** Yields pieces of the answer text as Groq generates them. */
  chunks: AsyncGenerator<string>;
  /** Stops the upstream request (e.g. the user left the page). */
  abort: () => void;
};

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 60_000;

export function aiConfig() {
  return {
    apiKey: process.env.GROQ_API_KEY?.trim() || "",
    baseUrl: (process.env.GROQ_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function isAiConfigured(): boolean {
  const { apiKey } = aiConfig();
  return apiKey.length > 20 && !/^your/i.test(apiKey);
}

/**
 * Starts a streamed chat completion. Connection, key, model and rate-limit
 * problems are reported up front as an AiError, before any text is streamed.
 */
export async function aiChatStream(messages: ChatMessage[]): Promise<AiStream | AiError> {
  const { apiKey, baseUrl, model } = aiConfig();
  if (!isAiConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message: "The AI assistant isn't set up yet. Add GROQ_API_KEY to .env.local and restart the server.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), TIMEOUT_MS);
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.2,
    // Reasoning models spend part of the budget thinking; leave room for the answer.
    max_completion_tokens: 2048,
    stream: true,
  };
  // gpt-oss models think before answering; "low" makes the first words appear sooner.
  if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(timer);
    const timedOut = controller.signal.aborted || (err instanceof Error && err.name === "TimeoutError");
    return {
      ok: false,
      reason: timedOut ? "timeout" : "provider",
      message: timedOut ? "The AI took too long to answer. Try again." : "Couldn't reach the AI service. Check your connection.",
    };
  }

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    return errorFromResponse(res, model);
  }

  const stream = res.body;
  return {
    ok: true,
    model,
    abort: () => controller.abort(),
    chunks: (async function* () {
      try {
        yield* parseSse(stream);
      } finally {
        clearTimeout(timer);
      }
    })(),
  };
}

async function errorFromResponse(res: Response, model: string): Promise<AiError> {
  if (res.status === 429) {
    return { ok: false, reason: "rate_limited", message: "The AI is receiving too many requests. Wait a minute and try again." };
  }
  const detail = providerError(await res.text().catch(() => ""));
  console.error("Groq API error", res.status, detail.slice(0, 500));
  // Some providers report a bad key as 400, not only 401/403.
  if (res.status === 401 || res.status === 403 || /api key|apikey|unauthori[sz]ed|authenticat/i.test(detail)) {
    return { ok: false, reason: "auth", message: "Groq rejected GROQ_API_KEY. Check the key in .env.local and restart the server." };
  }
  if (/model/i.test(detail)) {
    return { ok: false, reason: "provider", message: `The AI model "${model}" isn't available on Groq. Set GROQ_MODEL to a valid model name.` };
  }
  return { ok: false, reason: "provider", message: `The AI service couldn't answer (error ${res.status}). Try again in a moment.` };
}

/**
 * Reads Groq's server-sent events ("data: {...}" lines, ending with
 * "data: [DONE]") and yields the answer text from each delta. Reasoning
 * tokens are skipped; only the visible answer is passed on.
 */
async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        const text = deltaText(payload);
        if (text) yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function deltaText(payload: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  if ("error" in data) throw new Error(providerError(JSON.stringify(data)));
  if (!("choices" in data) || !Array.isArray(data.choices)) return null;
  const first: unknown = data.choices[0];
  if (!first || typeof first !== "object" || !("delta" in first)) return null;
  const delta: unknown = first.delta;
  if (!delta || typeof delta !== "object" || !("content" in delta)) return null;
  return typeof delta.content === "string" && delta.content ? delta.content : null;
}

/** Pulls the human-readable message out of an OpenAI-style error body. */
function providerError(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      if ("error" in parsed) {
        const err: unknown = parsed.error;
        if (typeof err === "string") return err;
        if (err && typeof err === "object" && "message" in err && typeof err.message === "string") return err.message;
      }
      if ("message" in parsed && typeof parsed.message === "string") return parsed.message;
    }
  } catch {
    // Not JSON; fall through to the raw text.
  }
  return body;
}
