import type { FactGroup } from "./context";

/**
 * /api/assistant replies in one of two ways:
 * - JSON (AssistantJson) when there's nothing to stream: setup notices and
 *   errors that happen before the AI starts answering.
 * - A stream of newline-separated JSON events (StreamEvent) while the AI
 *   answers: "facts" first, then many "delta" pieces of text, then "done"
 *   (or "error" if the answer breaks off).
 */
export type AssistantJson = {
  answer: null;
  facts: FactGroup[];
  error?: string;
  notice?: string;
};

export type StreamEvent =
  | { type: "facts"; facts: FactGroup[] }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export const STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";
