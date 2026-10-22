// Pulls a course and a date out of a natural-language question, so the
// assistant can fetch exactly the attendance the user asked about.
// Pure functions (no database), so they're easy to test.

type CourseLike = { id: string; name: string; code: string | null };

const STOP_WORDS = new Set(["and", "of", "the", "to", "for", "in", "on", "a", "an", "intro", "introduction"]);
// Two-letter acronyms that are also everyday words never count as a course.
const COMMON_SHORT = new Set(["is", "of", "to", "in", "on", "at", "it", "as", "be", "by", "do", "go", "if", "me", "my", "no", "or", "so", "up", "us", "we", "an", "am", "hi", "ok"]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const words = (s: string) => norm(s).split(" ").filter((w) => w && !STOP_WORDS.has(w));

/**
 * Courses named in the question. Matches the code ("CS-201", "cs201", "cs 201"),
 * the full name, the first two words of the name ("data structures"), the
 * acronym ("DSA", "OS"), or a distinctive long word ("algorithms").
 */
export function findCourses<T extends CourseLike>(question: string, courses: T[]): T[] {
  const qNorm = ` ${norm(question)} `;
  const tokens = norm(question).split(" ").filter(Boolean);
  const candidates = new Set(tokens);
  for (let i = 0; i < tokens.length - 1; i++) candidates.add(tokens[i] + tokens[i + 1]); // "cs 201" -> "cs201"

  // How many course names each long word appears in (only unique words are distinctive).
  const wordUse = new Map<string, number>();
  for (const c of courses) for (const w of new Set(words(c.name))) wordUse.set(w, (wordUse.get(w) ?? 0) + 1);

  return courses.filter((c) => {
    if (c.code && candidates.has(compact(c.code))) return true;
    const nameWords = words(c.name);
    if (nameWords.length === 0) return false;
    if (qNorm.includes(` ${nameWords.join(" ")} `) || qNorm.includes(` ${norm(c.name)} `)) return true;
    if (nameWords.length >= 2 && qNorm.includes(` ${nameWords.slice(0, 2).join(" ")} `)) return true;
    const acronym = nameWords.map((w) => w[0]).join("");
    if (acronym.length >= 2 && !COMMON_SHORT.has(acronym) && candidates.has(acronym)) return true;
    return nameWords.some((w) => w.length >= 6 && wordUse.get(w) === 1 && candidates.has(w));
  });
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const PKT_MS = 5 * 3600 * 1000;
const DAY_MS = 86_400_000;

function ymdFromUtcDay(dayMs: number): string {
  return new Date(dayMs).toISOString().slice(0, 10);
}

function validYmd(y: number, m: number, d: number): string | null {
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return ymdFromUtcDay(t);
}

/**
 * A single calendar date mentioned in the question, as "YYYY-MM-DD" (PKT).
 * Understands today / yesterday, weekday names (most recent one), ISO dates,
 * day-first numeric dates (15/10, 15-10-2026) and "15 Oct" / "October 15th".
 * Without a year, the most recent past occurrence is used.
 */
export function findDate(question: string, now: Date = new Date()): string | null {
  const q = question.toLowerCase();
  const todayMs = Date.UTC(
    new Date(now.getTime() + PKT_MS).getUTCFullYear(),
    new Date(now.getTime() + PKT_MS).getUTCMonth(),
    new Date(now.getTime() + PKT_MS).getUTCDate(),
  );
  const year = new Date(todayMs).getUTCFullYear();
  // A date without a year that lands in the future means last year's.
  const pastFix = (y: number | null, m: number, d: number) => {
    const ymd = validYmd(y ?? year, m, d);
    if (!ymd || y !== null) return ymd;
    return Date.parse(ymd) > todayMs + DAY_MS ? validYmd(year - 1, m, d) : ymd;
  };

  // Accept casual spellings: "todays", "today's", "2day", "yesterdays".
  if (/\bday before yesterday(?:'?s)?\b/.test(q)) return ymdFromUtcDay(todayMs - 2 * DAY_MS);
  if (/\b(?:yesterday|yday)(?:'?s)?\b/.test(q)) return ymdFromUtcDay(todayMs - DAY_MS);
  if (/\b(?:today|2day|tonight)(?:'?s)?\b|\bthis morning\b/.test(q)) return ymdFromUtcDay(todayMs);

  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(q);
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/.exec(q);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    return pastFix(y, Number(m[2]), Number(m[1]));
  }

  const monthRe = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
  m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthRe}(?:,?\\s+(\\d{4}))?\\b`).exec(q);
  if (m) return pastFix(m[3] ? Number(m[3]) : null, MONTHS.indexOf(m[2]) + 1, Number(m[1]));
  m = new RegExp(`\\b${monthRe}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`).exec(q);
  if (m) return pastFix(m[3] ? Number(m[3]) : null, MONTHS.indexOf(m[1]) + 1, Number(m[2]));

  const wd = new RegExp(`\\b(last\\s+)?(${WEEKDAYS.map((w) => `${w}|${w.slice(0, 3)}`).join("|")})(?:'?s)?\\b`).exec(q);
  if (wd) {
    const target = WEEKDAYS.findIndex((w) => wd[2].startsWith(w.slice(0, 3)));
    const todayDow = new Date(todayMs).getUTCDay();
    let back = (todayDow - target + 7) % 7;
    if (back === 0 && wd[1]) back = 7; // "last Monday" on a Monday = a week ago
    return ymdFromUtcDay(todayMs - back * DAY_MS);
  }
  return null;
}
