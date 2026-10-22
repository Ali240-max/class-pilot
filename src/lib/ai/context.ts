import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityType, Database } from "@/lib/database.types";
import { formatDateTime, formatLongDate, formatTime, pktDayStart, pktToday, timeRemaining } from "@/lib/time";
import { TYPE_LABEL, TYPE_LABEL_PLURAL } from "@/lib/whatsapp";
import { buildAttendanceContext } from "./attendance-context";
import { findCourses, findDate } from "./query-parse";

type DB = SupabaseClient<Database>;

/** A deterministic, database-backed fact shown next to the AI answer. */
export type FactItem = { primary: string; secondary?: string; tone?: "danger" | "warning" | "neutral" | "success" };
export type FactGroup = { title: string; items: FactItem[]; empty?: string };

type Intent = {
  activities: boolean;
  attendance: boolean;
  materials: boolean;
  window: "today" | "tomorrow" | "soon" | "week" | "upcoming";
  threshold: number;
  types: ActivityType[];
  /** True when the question names a topic itself (not a bare follow-up like "why?"). */
  explicit: boolean;
};

// Words that clearly mean deadlines, and time words that only do when the
// question isn't about attendance ("absent today" is not a deadline question).
const ACTIVITY_WORDS = /due|deadline|upcoming|remind|summar|next|overdue|plan|schedule|whatsapp|draft/;
const TIME_WORDS = /week|today|tonight|tomorrow/;

export function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  const attendance = /attend|absent|present|late|excused|defaulter|missed|miss class|bunk|below\s*\d+|percent|%|student|short/.test(q);
  const materials = /material|file|notes|slides|pdf|resource|upload|document/.test(q);
  const types: ActivityType[] = [];
  if (/assign|homework|submission/.test(q)) types.push("assignment");
  if (/quiz/.test(q)) types.push("quiz");
  if (/exam|midterm|final|paper/.test(q)) types.push("exam");
  const mentionsTime = TIME_WORDS.test(q);
  const mentionsActivities = types.length > 0 || ACTIVITY_WORDS.test(q) || (mentionsTime && !attendance);
  const explicit = mentionsActivities || mentionsTime || attendance || materials;
  const activities = mentionsActivities || (!attendance && !materials);
  // Reminders usually go out a day ahead, so "remind … today" covers today + tomorrow.
  const window = /tomorrow/.test(q)
    ? "tomorrow"
    : /remind/.test(q) && !/week/.test(q)
      ? "soon"
      : /today|tonight/.test(q)
        ? "today"
        : /week/.test(q)
          ? "week"
          : "upcoming";
  const thresholdMatch = /(\d{2})\s*%/.exec(q) ?? /below\s*(\d{2})/.exec(q);
  const threshold = thresholdMatch ? Math.min(100, Number(thresholdMatch[1])) : 75;
  return { activities, attendance, materials, window, threshold, types, explicit };
}

/**
 * Decides what data the latest question needs. Only the latest question counts,
 * so an earlier topic (e.g. assignments) never leaks into a new one (e.g.
 * attendance). A bare follow-up with no topic of its own ("and the reason?")
 * inherits the previous question's topic.
 */
export function resolveIntent(latest: string, previous?: string): Intent {
  const intent = detectIntent(latest);
  if (intent.explicit || !previous) return intent;
  return { ...detectIntent(previous), explicit: false };
}

export type AssistantContext = {
  /** Compact JSON-ready data handed to the model. */
  modelContext: Record<string, unknown>;
  facts: FactGroup[];
  hasAnyData: boolean;
};

export async function buildAssistantContext(supabase: DB, question: string, previousQuestion?: string): Promise<AssistantContext> {
  const intent = resolveIntent(question, previousQuestion);
  const now = new Date();
  const from = pktDayStart(-14, now).toISOString();
  const to = pktDayStart(45, now).toISOString();

  const [profileRes, coursesRes, activitiesRes, overdueRes] = await Promise.all([
    supabase.from("organizers").select("full_name, class_name, institution").maybeSingle(),
    supabase.from("courses").select("id, name, code, instructor_name, status").order("name"),
    supabase
      .from("academic_activities")
      .select("id, title, type, due_at, status, description, course_id")
      .gte("due_at", from)
      .lte("due_at", to)
      .order("due_at")
      .limit(80),
    supabase
      .from("academic_activities")
      .select("id, title, type, due_at, status, description, course_id")
      .eq("status", "scheduled")
      .lt("due_at", from)
      .order("due_at")
      .limit(20),
  ]);

  const courses = coursesRes.data ?? [];
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const courseText = (id: string | null) => {
    const c = id ? courseById.get(id) : undefined;
    return c ? (c.code ? `${c.name} (${c.code})` : c.name) : "Unknown course";
  };

  const allActivities = [...(overdueRes.data ?? []), ...(activitiesRes.data ?? [])];
  const activityView = allActivities.map((a) => {
    const due = new Date(a.due_at);
    const state =
      a.status === "completed" ? "completed" : a.status === "cancelled" ? "cancelled" : due < now ? "overdue" : "upcoming";
    return {
      title: a.title,
      type: a.type,
      course: courseText(a.course_id),
      due_pkt: formatDateTime(a.due_at),
      time_remaining: state === "upcoming" || state === "overdue" ? timeRemaining(a.due_at, now) : null,
      state,
      details: a.description ? a.description.slice(0, 300) : null,
      _due: due,
    };
  });

  const modelContext: Record<string, unknown> = {
    now_pkt: `${formatLongDate(now)} ${pktToday(now).slice(0, 4)}, ${formatTime(now)} (Asia/Karachi)`,
    today_pkt: pktToday(now),
    class: profileRes.data
      ? { organizer: profileRes.data.full_name, class_name: profileRes.data.class_name, institution: profileRes.data.institution }
      : null,
    courses: courses.map((c) => ({
      name: c.name,
      code: c.code,
      instructor: c.instructor_name,
      status: c.status,
    })),
  };

  const facts: FactGroup[] = [];
  let hasAnyData = courses.length > 0 || allActivities.length > 0;

  if (intent.activities) {
    modelContext.activities = activityView.map(({ _due, ...rest }) => {
      void _due;
      return rest;
    });

    const windows = {
      today: { end: 1, label: "Due today" },
      tomorrow: { end: 2, label: "Due tomorrow" },
      soon: { end: 2, label: "Due today & tomorrow" },
      week: { end: 7, label: "Due in the next 7 days" },
      upcoming: { end: 45, label: "Upcoming" },
    } as const;
    const windowEnd = pktDayStart(windows[intent.window].end, now);
    const windowStart = intent.window === "tomorrow" ? pktDayStart(1, now) : now;
    const label = windows[intent.window].label;

    const inWindow = activityView.filter(
      (a) =>
        a.state === "upcoming" &&
        a._due >= windowStart &&
        a._due < windowEnd &&
        (intent.types.length === 0 || intent.types.includes(a.type)),
    );
    const typeLabel = intent.types.length ? intent.types.map((t) => TYPE_LABEL_PLURAL[t]).join(" & ") : "Activities";
    facts.push({
      title: `${label} · ${typeLabel}`,
      items: inWindow.slice(0, 10).map((a) => ({
        primary: `${TYPE_LABEL[a.type]}: ${a.title}`,
        secondary: `${a.course} · ${a.due_pkt} · ${a.time_remaining}`,
        tone: a._due < pktDayStart(1, now) ? "warning" : "neutral",
      })),
      empty: "Nothing scheduled in this window.",
    });

    const overdue = activityView.filter((a) => a.state === "overdue");
    if (overdue.length) {
      facts.push({
        title: "Overdue (still marked scheduled)",
        items: overdue.slice(0, 6).map((a) => ({
          primary: `${TYPE_LABEL[a.type]}: ${a.title}`,
          secondary: `${a.course} · was due ${a.due_pkt}`,
          tone: "danger",
        })),
      });
    }
  }

  // Course and date named in the question. A bare follow-up ("what about OS?",
  // "and on Monday?") keeps whatever the previous question didn't override.
  const inherit = !intent.explicit && previousQuestion ? previousQuestion : null;
  let scopedCourses = findCourses(question, courses);
  if (!scopedCourses.length && inherit) scopedCourses = findCourses(inherit, courses);
  const date = findDate(question, now) ?? (inherit ? findDate(inherit, now) : null);

  if (intent.attendance) {
    const attendance = await buildAttendanceContext(supabase, {
      question,
      threshold: intent.threshold,
      courses: scopedCourses,
      allCourses: courses,
      date,
    });
    hasAnyData ||= attendance.hasData;
    modelContext.attendance = attendance.model;
    facts.push(...attendance.facts);
  }

  if (intent.materials) {
    const matRes = await supabase
      .from("materials")
      .select("title, description, file_name, mime_type, course_id, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    const mats = (matRes.data ?? []).map((m) => ({
      title: m.title,
      course: courseText(m.course_id),
      file: m.file_name,
      added: formatDateTime(m.created_at),
      description: m.description?.slice(0, 200) ?? null,
    }));
    hasAnyData ||= mats.length > 0;
    modelContext.materials = mats;

    const mentioned = scopedCourses[0];
    const shown = mentioned ? mats.filter((m) => m.course === courseText(mentioned.id)) : mats;
    facts.push({
      title: mentioned ? `Materials · ${mentioned.name}` : "Recent materials",
      items: shown.slice(0, 8).map((m) => ({ primary: m.title, secondary: `${m.course} · ${m.file}` })),
      empty: "No materials uploaded yet.",
    });
  }

  return { modelContext, facts, hasAnyData };
}

export const SYSTEM_PROMPT = `You are ClassPilot, an assistant for a university class representative (CR/GR) in Pakistan.
You help them understand deadlines, attendance and materials, and draft class announcements.

Rules:
- Answer ONLY the user's latest message. Earlier messages are background for follow-ups; don't repeat earlier answers or lists unless asked.
- Use ONLY the CLASS DATA provided below. It comes from the class database.
- Never invent or estimate dates, times, marks, attendance figures, student names, courses or announcements. If something isn't in the data, say plainly that it isn't recorded.
- When describing an activity, use only that activity's own fields (title, course, due time, details). Never borrow rooms, chapters or instructions from a different activity. If a detail like the room isn't in its details, leave it out.
- All times are Pakistan Standard Time (PKT). Quote times exactly as given.
- Attendance is saved per course and date. Percentages and lists are already calculated; repeat them exactly, don't recompute. Follow attendance.how_to_answer.
- When you give advice or opinions, label it clearly as a suggestion.
- WhatsApp drafts: short, friendly, use *bold* for key items, emojis sparingly, and end with "— Your CR". Never claim a message was sent.
- Keep answers concise and scannable. Use short bullet lists where helpful. No markdown tables or headings.`;
