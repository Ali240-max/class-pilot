import type { ActivityStatus } from "./database.types";

type Dated = { status: ActivityStatus; due_at: string };

/**
 * Deadline predicates evaluated against one fixed "now" for the whole request,
 * so every list on a page agrees on what is upcoming vs overdue.
 */
export function deadlineChecks(now: Date = new Date()) {
  const t = now.getTime();
  return {
    isUpcoming: (a: Dated) => a.status === "scheduled" && new Date(a.due_at).getTime() >= t,
    isOverdue: (a: Dated) => a.status === "scheduled" && new Date(a.due_at).getTime() < t,
    dueBefore: (a: Dated, end: Date) => new Date(a.due_at).getTime() < end.getTime(),
  };
}
