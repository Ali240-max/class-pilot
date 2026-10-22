import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { attendancePercent, emptyTally, fetchRecordsForSessions, type Tally } from "@/lib/attendance";
import { formatPlainDate } from "@/lib/time";
import type { FactGroup } from "./context";

type DB = SupabaseClient<Database>;
type Course = { id: string; name: string; code: string | null; status: string };

const DEFINITION = "percent = (present + late) / (present + late + absent); excused sessions are not counted";

export type AttendanceScope = {
  question: string;
  threshold: number;
  /** Courses named in the question (empty = whole class). */
  courses: Course[];
  allCourses: Course[];
  /** "YYYY-MM-DD" named in the question, if any. */
  date: string | null;
};

const label = (c: Course | undefined) => (c ? (c.code ? `${c.name} (${c.code})` : c.name) : "General session (no course)");
const byName = (a: string, b: string) => a.localeCompare(b);

/**
 * Attendance data for the assistant. Everything here is computed in code
 * (lists, counts, percentages, threshold checks); the model only reports it.
 * Only names and numbers are included, never phone numbers or notes.
 */
export async function buildAttendanceContext(supabase: DB, scope: AttendanceScope) {
  const { threshold, courses: scoped, allCourses, date } = scope;
  const facts: FactGroup[] = [];
  const model: Record<string, unknown> = { definition: DEFINITION, threshold_percent: threshold };
  const courseById = new Map(allCourses.map((c) => [c.id, c]));

  const { data: studentRows, error } = await supabase.from("students").select("id, full_name, status").order("full_name");
  if (error) throw new Error(error.message);
  const students = studentRows ?? [];
  const nameOf = new Map(students.map((s) => [s.id, s.full_name]));
  const active = students.filter((s) => s.status === "active");
  if (students.length === 0) return { model, facts, hasData: false };

  // ── A. Specific sessions (a date and/or course was named) ────────────────
  if (date || scoped.length) {
    let q = supabase.from("attendance_sessions").select("id, session_date, course_id, notes");
    if (date) q = q.eq("session_date", date);
    if (scoped.length) q = q.in("course_id", scoped.map((c) => c.id));
    const { data: sessionRows, error: sErr } = await q.order("session_date", { ascending: false }).limit(date ? 20 : 6);
    if (sErr) throw new Error(sErr.message);
    const sessions = sessionRows ?? [];
    const records = await fetchRecordsForSessions(supabase, sessions.map((s) => s.id));

    const requested = [scoped.length ? scoped.map(label).join(", ") : null, date ? formatPlainDate(date) : null].filter(Boolean).join(" on ");
    model.requested = { courses: scoped.map(label), date: date ? formatPlainDate(date) : null };

    const sessionViews = sessions.map((s) => {
      const recs = records.filter((r) => r.session_id === s.id);
      const lists: Record<keyof Tally, string[]> = { present: [], late: [], absent: [], excused: [] };
      for (const r of recs) lists[r.status].push(nameOf.get(r.student_id) ?? "Unknown student");
      for (const k of Object.keys(lists) as (keyof Tally)[]) lists[k].sort(byName);
      const markedIds = new Set(recs.map((r) => r.student_id));
      const notMarked = recs.length ? active.filter((st) => !markedIds.has(st.id)).map((st) => st.full_name) : [];
      const tally: Tally = { present: lists.present.length, late: lists.late.length, absent: lists.absent.length, excused: lists.excused.length };
      return {
        date: formatPlainDate(s.session_date),
        course: label(s.course_id ? courseById.get(s.course_id) : undefined),
        notes: s.notes,
        marked: recs.length > 0,
        counts: tally,
        attendance_percent: attendancePercent(tally),
        ...lists,
        not_marked: notMarked,
      };
    });
    model.sessions = sessionViews;
    if (sessionViews.length === 0) {
      model.no_session_found = `No attendance session is recorded for ${requested}. Attendance is saved per course and date, so none was taken (or it wasn't entered) for this one.`;
    }

    // With a date, show every matching session; for a course alone, just its latest class.
    const shown = date ? sessionViews.slice(0, 4) : sessionViews.slice(0, 1);
    if (shown.length === 0) {
      facts.push({ title: `Attendance · ${requested}`, items: [], empty: "No attendance session recorded for this." });
    }
    for (const v of shown) {
      const items: FactGroup["items"] = [];
      if (!v.marked) items.push({ primary: "Session created but not marked yet", tone: "warning" });
      else {
        items.push({ primary: `${v.counts.present + v.counts.late} of ${v.counts.present + v.counts.late + v.counts.absent} attended`, secondary: v.attendance_percent === null ? undefined : `${v.attendance_percent}%`, tone: "success" });
        if (v.absent.length) items.push({ primary: `Absent (${v.absent.length})`, secondary: v.absent.join(", "), tone: "danger" });
        if (v.late.length) items.push({ primary: `Late (${v.late.length})`, secondary: v.late.join(", "), tone: "warning" });
        if (v.excused.length) items.push({ primary: `Excused (${v.excused.length})`, secondary: v.excused.join(", ") });
        if (v.not_marked.length) items.push({ primary: `Not marked (${v.not_marked.length})`, secondary: v.not_marked.join(", ") });
      }
      facts.push({ title: `${date ? "" : "Latest class · "}${v.course} · ${v.date}`, items });
    }
  }

  // ── B. Per-course percentages ────────────────────────────────────────────
  const wantsBreakdown = /course|subject|each|wise|breakdown|per class|every class/.test(scope.question.toLowerCase());
  if (scoped.length || (wantsBreakdown && !date)) {
    const statCourses = scoped.length ? scoped : allCourses.filter((c) => c.status === "active");
    const { data: courseSessions, error: cErr } = await supabase
      .from("attendance_sessions")
      .select("id, course_id")
      .in("course_id", statCourses.map((c) => c.id))
      .limit(5000);
    if (cErr) throw new Error(cErr.message);
    const sessionCourse = new Map((courseSessions ?? []).map((s) => [s.id, s.course_id]));
    const records = await fetchRecordsForSessions(supabase, [...sessionCourse.keys()]);

    // course -> student -> tally
    const tallies = new Map<string, Map<string, Tally>>();
    for (const r of records) {
      const cid = sessionCourse.get(r.session_id);
      if (!cid) continue;
      const perStudent = tallies.get(cid) ?? new Map<string, Tally>();
      const t = perStudent.get(r.student_id) ?? emptyTally();
      t[r.status] += 1;
      perStudent.set(r.student_id, t);
      tallies.set(cid, perStudent);
    }

    model.by_course = statCourses.map((c) => {
      const perStudent = tallies.get(c.id) ?? new Map<string, Tally>();
      const rows = active
        .map((st) => {
          const t = perStudent.get(st.id) ?? emptyTally();
          return { name: st.full_name, percent: attendancePercent(t), attended: t.present + t.late, counted: t.present + t.late + t.absent };
        })
        .filter((r) => r.counted > 0);
      const below = rows.filter((r) => r.percent !== null && r.percent < threshold).sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0));
      return {
        course: label(c),
        sessions_held: (courseSessions ?? []).filter((s) => s.course_id === c.id).length,
        students_below_threshold: below.map((r) => r.name),
        students: rows,
        _below: below,
      };
    });

    for (const entry of model.by_course as { course: string; sessions_held: number; _below: { name: string; percent: number | null; attended: number; counted: number }[] }[]) {
      if (scoped.length || entry._below.length) {
        facts.push({
          title: `Below ${threshold}% in ${entry.course}`,
          items: entry._below.map((r) => ({
            primary: r.name,
            secondary: `${r.percent}% · attended ${r.attended} of ${r.counted} classes`,
            tone: (r.percent ?? 0) < 60 ? "danger" : "warning",
          })),
          empty: entry.sessions_held === 0 ? "No attendance recorded for this course yet." : `Everyone is at or above ${threshold}% in this course.`,
        });
      }
    }
    // The helper field is only for the facts panel.
    model.by_course = (model.by_course as Record<string, unknown>[]).map((e) => {
      const copy = { ...e };
      delete copy._below;
      return copy;
    });
  }

  // ── C. Overall (whole class, all courses together) ───────────────────────
  if (!scoped.length && !date) {
    const { data: summary, error: sumErr } = await supabase.from("student_attendance_summary").select("*");
    if (sumErr) throw new Error(sumErr.message);
    const sums = new Map((summary ?? []).map((s) => [s.student_id, s]));
    const rows = active.map((s) => {
      const sum = sums.get(s.id);
      return {
        name: s.full_name,
        attendance_percent: sum?.attendance_percent ?? null,
        attended: sum ? sum.present_count + sum.late_count : 0,
        counted_sessions: sum?.counted_sessions ?? 0,
        absences: sum?.absent_count ?? 0,
      };
    });
    const below = rows
      .filter((r) => r.attendance_percent !== null && r.attendance_percent < threshold)
      .sort((a, b) => (a.attendance_percent ?? 0) - (b.attendance_percent ?? 0));
    model.overall = { students_below_threshold: below.map((r) => r.name), active_students: rows };

    // Recent sessions, so the model knows per-course attendance exists even
    // when the question didn't name a course or date.
    const { data: recent, error: rErr } = await supabase
      .from("attendance_sessions")
      .select("id, session_date, course_id")
      .order("session_date", { ascending: false })
      .limit(10);
    if (rErr) throw new Error(rErr.message);
    const recentRecs = await fetchRecordsForSessions(supabase, (recent ?? []).map((s) => s.id));
    model.recent_sessions = (recent ?? []).map((s) => {
      const t = emptyTally();
      for (const r of recentRecs) if (r.session_id === s.id) t[r.status] += 1;
      return { date: formatPlainDate(s.session_date), course: label(s.course_id ? courseById.get(s.course_id) : undefined), counts: t, attendance_percent: attendancePercent(t) };
    });
    if (!wantsBreakdown) {
      facts.push({
        title: `Attendance below ${threshold}% (all courses)`,
        items: below.map((r) => ({
          primary: r.name,
          secondary: `${r.attendance_percent}% · attended ${r.attended} of ${r.counted_sessions} sessions`,
          tone: (r.attendance_percent ?? 0) < 60 ? "danger" : "warning",
        })),
        empty: rows.some((r) => r.counted_sessions > 0) ? `No active student is below ${threshold}%.` : "No attendance has been recorded yet.",
      });
    }
  }

  model.how_to_answer = [
    "Specific date and/or course → use `sessions` (names per status). If `no_session_found` is set, say no attendance was recorded for that course/date — never say the app can't store it.",
    "Course percentages / who is short in a course → use `by_course` and list exactly its students_below_threshold.",
    "Whole-class percentages → use `overall`. `recent_sessions` lists the latest classes per course; if the user wants names for one of them, tell them to ask with that course and date.",
  ];
  return { model, facts, hasData: true };
}
