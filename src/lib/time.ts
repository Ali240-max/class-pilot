// All dates in ClassPilot are shown and entered in Pakistan Standard Time.
// PKT is UTC+05:00 all year (no daylight saving), so a fixed offset is exact.
export const TIME_ZONE = "Asia/Karachi";
const PKT_OFFSET = "+05:00";
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Formatting is done by hand (not Intl) so the server and browser always
// produce identical text, which avoids hydration mismatches.
function pktParts(input: string | Date) {
  const d = new Date(new Date(input).getTime() + PKT_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

export function formatTime(iso: string | Date): string {
  const p = pktParts(iso);
  const h12 = p.hour % 12 || 12;
  return `${h12}:${String(p.minute).padStart(2, "0")} ${p.hour < 12 ? "AM" : "PM"}`;
}

/** "Thu, 23 Oct, 9:00 AM" (adds the year when it isn't the current year). */
export function formatDateTime(iso: string | Date, now: Date = new Date()): string {
  const p = pktParts(iso);
  const year = p.year !== pktParts(now).year ? ` ${p.year}` : "";
  return `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month]}${year}, ${formatTime(iso)}`;
}

/** "Thu, 23 Oct 2026" */
export function formatDate(iso: string | Date): string {
  const p = pktParts(iso);
  return `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/** "Thursday, 23 October" */
export function formatLongDate(iso: string | Date): string {
  const p = pktParts(iso);
  return `${WEEKDAYS_LONG[p.weekday]}, ${p.day} ${MONTHS_LONG[p.month]}`;
}

/** "2026-10-22" for a plain `date` column, formatted without timezone shifts. */
export function formatPlainDate(ymd: string): string {
  return formatDate(new Date(`${ymd}T12:00:00${PKT_OFFSET}`));
}

/** Converts a `<input type="datetime-local">` value typed in PKT to an ISO string. */
export function pktInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00${PKT_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Converts an ISO timestamp to a `datetime-local` value in PKT. */
export function isoToPktInput(iso: string): string {
  return new Date(new Date(iso).getTime() + PKT_OFFSET_MS).toISOString().slice(0, 16);
}

/** Today's date in PKT as "YYYY-MM-DD". */
export function pktToday(now: Date = new Date()): string {
  return new Date(now.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start of a PKT calendar day (offset in days from today) as a Date. */
export function pktDayStart(offsetDays = 0, now: Date = new Date()): Date {
  const start = new Date(`${pktToday(now)}T00:00:00${PKT_OFFSET}`);
  return new Date(start.getTime() + offsetDays * 24 * 60 * 60 * 1000);
}

/** Human countdown such as "in 2d 4h", "in 35m" or "3h overdue". */
export function timeRemaining(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let text: string;
  if (days >= 1) text = `${days}d${hours % 24 ? ` ${hours % 24}h` : ""}`;
  else if (hours >= 1) text = `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  else text = `${Math.max(minutes, 1)}m`;

  return diff >= 0 ? `in ${text}` : `${text} overdue`;
}

export type Urgency = "overdue" | "today" | "soon" | "later";

export function urgencyOf(iso: string, now: Date = new Date()): Urgency {
  const due = new Date(iso).getTime();
  if (due < now.getTime()) return "overdue";
  if (due < pktDayStart(1, now).getTime()) return "today";
  if (due < now.getTime() + 3 * 24 * 60 * 60 * 1000) return "soon";
  return "later";
}
