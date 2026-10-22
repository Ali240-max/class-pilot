"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUp, Database, RotateCcw, Sparkles, Square } from "lucide-react";
import type { AssistantJson, StreamEvent } from "@/lib/ai/protocol";
import type { FactGroup } from "@/lib/ai/context";
import { cn, stagger } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-dialog";

type AssistantTurn = {
  role: "assistant";
  id: number;
  /** Answer text received so far (grows while streaming). */
  content: string;
  facts: FactGroup[];
  /** True while text is still arriving. */
  streaming: boolean;
  /** True only when the AI finished normally; only these go into history. */
  complete: boolean;
  error?: string;
  notice?: string;
};

type Turn = { role: "user"; content: string } | AssistantTurn;

const SUGGESTIONS = [
  "What assignments are due this week?",
  "Which quiz is coming up next?",
  "What should I remind the class about today?",
  "Which students have attendance below 75%?",
  "Summarize this week's class activities",
  "Draft a WhatsApp reminder for tomorrow's quiz",
  "What materials are available for Data Structures?",
];

/** Minimal formatter: bullet lines and *bold* / **bold*. React escapes all text. */
function renderAnswer(text: string): ReactNode {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, i) =>
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : /^\*[^*]+\*$/.test(part) ? (
        <strong key={i}>{part.slice(1, -1)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1.5 list-disc space-y-1 pl-5 marker:text-muted">
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  let tableRows: string[][] = [];
  const flushTable = () => {
    if (tableRows.length) {
      const [head, ...body] = tableRows;
      blocks.push(
        <div key={`tb-${blocks.length}`} className="my-2 overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface-2 text-ink-2">
              <tr>
                {head.map((c, i) => (
                  <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, i) => (
                    <td key={i} className="px-3 py-1.5 tabular-nums">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      tableRows = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    // Markdown table row: "| a | b |". The "|---|---|" separator row is skipped.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      if (!/^\s*\|[\s:|-]+\|\s*$/.test(line)) tableRows.push(line.trim().slice(1, -1).split("|").map((c) => c.trim()));
      continue;
    }
    flushTable();
    const m = /^\s*(?:[-•]|\d+\.)\s+(.*)$/.exec(line);
    if (m) {
      bullets.push(m[1]);
      continue;
    }
    flush();
    if (line.trim() === "") blocks.push(<div key={`sp-${blocks.length}`} className="h-2" />);
    else
      blocks.push(
        <p key={`p-${blocks.length}`} className="leading-relaxed">
          {inline(line.replace(/^#+\s*/, ""))}
        </p>,
      );
  }
  flush();
  flushTable();
  return blocks;
}

function FactsPanel({ facts }: { facts: FactGroup[] }) {
  if (facts.length === 0) return null;
  return (
    <div className="animate-fade-up rounded-2xl border border-line bg-surface-2/60 p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-success uppercase">
        <Database className="size-3.5" aria-hidden />
        From your class database
      </p>
      <div className="space-y-3">
        {facts.map((g) => (
          <div key={g.title}>
            <p className="text-[13px] font-semibold text-ink">{g.title}</p>
            {g.items.length === 0 ? (
              <p className="mt-0.5 text-[13px] text-muted">{g.empty}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {g.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-[13px]">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        it.tone === "danger" ? "bg-danger" : it.tone === "warning" ? "bg-warning" : it.tone === "success" ? "bg-success" : "bg-brand",
                      )}
                    />
                    <span>
                      <span className="font-medium text-ink">{it.primary}</span>
                      {it.secondary && <span className="block text-xs text-muted">{it.secondary}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


/**
 * Conversation text sent to the server: only question/answer pairs where the AI
 * finished answering (last 4). Failed, cut-off or fact-only replies are left
 * out, and the database facts are never sent back.
 */
function answeredHistory(turns: Turn[]): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < turns.length - 1; i++) {
    const q = turns[i];
    const a = turns[i + 1];
    if (q.role === "user" && a.role === "assistant" && a.complete && a.content) {
      out.push({ role: "user", content: q.content }, { role: "assistant", content: a.content });
      i++;
    }
  }
  return out.slice(-8);
}

/**
 * Reveals text a few characters per animation frame, like someone typing.
 * It speeds up when a lot of text is waiting, so it never lags far behind
 * the stream. Answers that were already complete when mounted show at once.
 */
function TypedAnswer({ text, live, onProgress }: { text: string; live: boolean; onProgress: () => void }) {
  const [shown, setShown] = useState(live ? 0 : text.length);
  const typing = shown < text.length;

  useEffect(() => {
    if (!typing) return;
    const frame = requestAnimationFrame(() => {
      setShown((s) => Math.min(text.length, s + Math.max(2, Math.ceil((text.length - s) / 18))));
      onProgress();
    });
    return () => cancelAnimationFrame(frame);
  }, [typing, shown, text, onProgress]);

  return (
    <div className={cn("text-sm text-ink", (typing || live) && "typing-caret")}>{renderAnswer(text.slice(0, shown))}</div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="AI is thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-brand/70" style={{ animationDelay: `${i * 140}ms` }} />
      ))}
    </span>
  );
}

let nextTurnId = 1;

export function AssistantChat({ aiConfigured, showFacts }: { aiConfigured: boolean; showFacts: boolean }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // A ref (not state) blocks a second send before React re-renders,
  // e.g. a fast double Enter or double tap.
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Stop any running answer when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending]);

  // Keep the newest text in view while it types, unless the user scrolled up to read.
  const followTyping = useCallback(() => {
    const el = endRef.current;
    if (!el) return;
    const distance = el.getBoundingClientRect().top - window.innerHeight;
    if (distance < 160) el.scrollIntoView({ block: "end" });
  }, []);

  function updateTurn(id: number, patch: (t: AssistantTurn) => Partial<AssistantTurn>) {
    setTurns((all) => all.map((t) => (t.role === "assistant" && t.id === id ? { ...t, ...patch(t) } : t)));
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || inFlight.current) return;
    inFlight.current = true;
    const messages = [...answeredHistory(turns), { role: "user" as const, content: q }];
    setTurns((t) => [...t, { role: "user", content: q }]);
    setInput("");
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const id = nextTurnId++;
    const base: AssistantTurn = { role: "assistant", id, content: "", facts: [], streaming: false, complete: false };

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
      if (res.status === 401) {
        router.push("/login?next=/assistant");
        return;
      }

      // Plain JSON = nothing to stream (setup notice or an error before the AI started).
      if (!(res.headers.get("content-type") ?? "").includes("ndjson") || !res.body) {
        const data = (await res.json().catch(() => null)) as Partial<AssistantJson> | null;
        setTurns((t) => [
          ...t,
          { ...base, facts: data?.facts ?? [], error: data?.error ?? (res.ok ? undefined : "Something went wrong. Try again."), notice: data?.notice },
        ]);
        return;
      }

      setTurns((t) => [...t, { ...base, streaming: true }]);
      setPending(false);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "facts") updateTurn(id, () => ({ facts: event.facts }));
          else if (event.type === "delta") updateTurn(id, (t) => ({ content: t.content + event.text }));
          else if (event.type === "done") {
            updateTurn(id, () => ({ streaming: false, complete: true }));
            finished = true;
          } else if (event.type === "error") {
            updateTurn(id, () => ({ streaming: false, error: event.message }));
            finished = true;
          }
        }
      }
      if (!finished) updateTurn(id, () => ({ streaming: false, error: "The connection dropped before the answer finished. Try again." }));
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setTurns((t) =>
        t.some((x) => x.role === "assistant" && x.id === id)
          ? t.map((x) => (x.role === "assistant" && x.id === id ? { ...x, streaming: false, error: "The answer was interrupted. Try again." } : x))
          : [...t, { ...base, error: "Couldn't reach the server. Check your connection." }],
      );
    } finally {
      inFlight.current = false;
      abortRef.current = null;
      setPending(false);
      inputRef.current?.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
    setTurns((all) => all.map((t) => (t.role === "assistant" && t.streaming ? { ...t, streaming: false, error: "Stopped." } : t)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  const busy = pending || turns.some((t) => t.role === "assistant" && t.streaming);

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col lg:min-h-[calc(100dvh-12rem)]">
      {!aiConfigured && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            AI answers are off until <code className="font-mono text-xs">GROQ_API_KEY</code> is set. You&apos;ll still see facts straight from your
            database.
          </span>
        </div>
      )}

      <div className="flex-1 space-y-5">
        {turns.length === 0 && (
          <div className="animate-fade-up py-6 text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Sparkles className="size-7" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold">Ask about your class</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Answers use your real deadlines, attendance and materials. Phone numbers are never sent to the AI.
            </p>
            <div className="stagger mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  style={stagger(i)}
                  className="rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] text-ink-2 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => {
          if (t.role === "user") {
            return (
              <div key={`u-${i}`} className="flex animate-fade-up justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm whitespace-pre-wrap text-on-brand">
                  {t.content}
                </p>
              </div>
            );
          }
          // The database panel is optional (Settings). It's always shown when the AI
          // couldn't answer, so there's still something useful on screen.
          const aiFailed = !t.content && Boolean(t.error);
          const showPanel = showFacts || aiFailed;
          const showBubble = t.streaming || t.content;
          return (
            <div key={`a-${t.id}`} className="flex max-w-[min(100%,44rem)] animate-fade-up gap-2.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1 space-y-2.5">
                {showPanel && <FactsPanel facts={t.facts} />}
                {showBubble && (
                  <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 shadow-card" aria-live="polite" aria-busy={t.streaming}>
                    {t.content ? <TypedAnswer text={t.content} live={t.streaming} onProgress={followTyping} /> : <ThinkingDots />}
                    {t.complete && (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                        <span className="text-[11px] text-muted">AI-generated · check before sharing</span>
                        <ShareButton message={t.content.replace(/\*\*/g, "*")} title="Class update" label="Share / copy" variant="ghost" />
                      </div>
                    )}
                  </div>
                )}
                {t.notice && <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">{t.notice}</p>}
                {t.error && (
                  <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {t.error}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {pending && (
          <div className="flex animate-fade-in items-center gap-2.5" role="status">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
              <Sparkles className="size-4" />
            </span>
            <span className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-2.5 shadow-card">
              <ThinkingDots />
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-20 mt-6 lg:bottom-6">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-pop focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <label htmlFor="assistant-input" className="sr-only">
            Ask a question
          </label>
          <textarea
            id="assistant-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask about deadlines, attendance, materials…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-ink placeholder:text-muted/70 focus:outline-none sm:text-sm"
          />
          {turns.length > 0 && !busy && (
            <Button variant="ghost" size="icon" onClick={() => setTurns([])} aria-label="Start a new conversation">
              <RotateCcw className="size-4" />
            </Button>
          )}
          {busy ? (
            <Button size="icon" variant="secondary" onClick={stop} aria-label="Stop answering">
              <Square className="size-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
