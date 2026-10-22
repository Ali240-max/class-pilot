export type ChatTurn = { role: "user" | "assistant"; content: string };

export const MAX_QUESTION = 2000;
const MAX_HISTORY_ANSWER = 2000;
const MAX_HISTORY_MESSAGES = 8; // last 4 question/answer exchanges

/**
 * Turns whatever the client sent into a valid conversation for the model:
 * strictly alternating user/assistant pairs (only questions that actually got
 * an answer), followed by the new question. Unanswered questions are dropped,
 * so the model never sees two questions in a row and answers both.
 * Returns null when the last message isn't a usable user question.
 */
export function sanitizeHistory(raw: ChatTurn[]): { history: ChatTurn[]; question: string; previousQuestion?: string } | null {
  const msgs = raw.map((m) => ({ role: m.role, content: m.content.trim() })).filter((m) => m.content.length > 0);
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== "user" || last.content.length > MAX_QUESTION) return null;

  const pairs: ChatTurn[] = [];
  const earlier = msgs.slice(0, -1);
  for (let i = 0; i < earlier.length - 1; i++) {
    if (earlier[i].role === "user" && earlier[i + 1].role === "assistant") {
      pairs.push(
        { role: "user", content: earlier[i].content.slice(0, MAX_QUESTION) },
        { role: "assistant", content: earlier[i + 1].content.slice(0, MAX_HISTORY_ANSWER) },
      );
      i++;
    }
  }

  const history = pairs.slice(-MAX_HISTORY_MESSAGES);
  const previousQuestion = history.length ? history[history.length - 2].content : undefined;
  return { history, question: last.content, previousQuestion };
}
