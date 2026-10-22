import type { ActivityType } from "./database.types";
import { formatDateTime, timeRemaining } from "./time";
import { waDigits } from "./phone";

export const TYPE_LABEL: Record<ActivityType, string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  exam: "Exam",
};

export const TYPE_LABEL_PLURAL: Record<ActivityType, string> = {
  assignment: "Assignments",
  quiz: "Quizzes",
  exam: "Exams",
};

const TYPE_EMOJI: Record<ActivityType, string> = {
  assignment: "📝",
  quiz: "❓",
  exam: "🎓",
};

export type ShareableActivity = {
  title: string;
  type: ActivityType;
  due_at: string;
  description: string | null;
  course: { name: string; code: string | null } | null;
};

function courseLabel(course: ShareableActivity["course"]): string {
  if (!course) return "";
  return course.code ? `${course.name} (${course.code})` : course.name;
}

/** Announcement / reminder text for one activity. WhatsApp uses *bold* and _italic_. */
export function buildActivityMessage(a: ShareableActivity, now: Date = new Date()): string {
  const lines = [
    `${TYPE_EMOJI[a.type]} *${TYPE_LABEL[a.type]} Reminder*`,
    "",
    `*${a.title}*`,
  ];
  const course = courseLabel(a.course);
  if (course) lines.push(`📚 ${course}`);
  lines.push(`🗓️ ${formatDateTime(a.due_at)} (PKT)`);
  if (new Date(a.due_at) > now) lines.push(`⏳ Due ${timeRemaining(a.due_at, now)}`);
  if (a.description) lines.push("", a.description);
  lines.push("", "_— Your CR_");
  return lines.join("\n");
}

/** One message covering several activities, for daily / weekly summaries. */
export function buildDigestMessage(
  heading: string,
  activities: ShareableActivity[],
  now: Date = new Date(),
): string {
  if (activities.length === 0) return `*${heading}*\n\nNothing due. Enjoy the break! 🎉\n\n_— Your CR_`;
  const lines = [`*${heading}*`, ""];
  activities.forEach((a, i) => {
    const course = a.course?.code ?? a.course?.name ?? "";
    lines.push(
      `${i + 1}. ${TYPE_EMOJI[a.type]} *${a.title}*${course ? ` — ${course}` : ""}`,
      `    ${formatDateTime(a.due_at)} (${timeRemaining(a.due_at, now)})`,
    );
  });
  lines.push("", "_— Your CR_");
  return lines.join("\n");
}

/**
 * wa.me link. With a phone number it opens that chat; without one WhatsApp
 * asks the user to pick a chat or group. Nothing is sent until they tap Send.
 */
export function whatsappUrl(text: string, phoneE164?: string | null): string {
  const base = phoneE164 ? `https://wa.me/${waDigits(phoneE164)}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
