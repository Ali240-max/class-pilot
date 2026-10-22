"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, CheckCheck, Eraser, Loader2, Search, UserX } from "lucide-react";
import type { AttendanceStatus } from "@/lib/database.types";
import { cn } from "@/lib/cn";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { Avatar } from "@/components/attendance-pill";
import { saveAttendance } from "../actions";

export type MarkerStudent = { id: string; full_name: string; student_code: string | null; inactive: boolean };
type Mark = AttendanceStatus | null;

const STATUSES: { value: AttendanceStatus; label: string; short: string; active: string; dot: string }[] = [
  { value: "present", label: "Present", short: "P", active: "bg-success text-on-brand border-success", dot: "bg-success" },
  { value: "absent", label: "Absent", short: "A", active: "bg-danger text-on-brand border-danger", dot: "bg-danger" },
  { value: "late", label: "Late", short: "L", active: "bg-warning text-on-brand border-warning", dot: "bg-warning" },
  { value: "excused", label: "Excused", short: "E", active: "bg-info text-on-brand border-info", dot: "bg-info" },
];

export function AttendanceMarker({
  sessionId,
  students,
  initial,
}: {
  sessionId: string;
  students: MarkerStudent[];
  initial: Record<string, AttendanceStatus>;
}) {
  const router = useRouter();
  // `saved` is what's in the database; `marks` is what's on screen.
  const [saved, setSaved] = useState<Record<string, Mark>>(initial);
  const [marks, setMarks] = useState<Record<string, Mark>>(initial);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, startSaving] = useTransition();

  const changed = useMemo(() => students.filter((s) => (marks[s.id] ?? null) !== (saved[s.id] ?? null)), [students, marks, saved]);
  const dirty = changed.length > 0;

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    for (const s of students) c[marks[s.id] ?? "unmarked"] += 1;
    return c;
  }, [students, marks]);
  const counted = counts.present + counts.late + counts.absent;
  const pct = counted ? Math.round((100 * (counts.present + counts.late)) / counted) : null;
  const markedShare = students.length ? ((students.length - counts.unmarked) / students.length) * 100 : 0;

  // Warn before leaving the page with unsaved marks.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? students.filter((s) => s.full_name.toLowerCase().includes(needle) || (s.student_code?.toLowerCase().includes(needle) ?? false))
    : students;

  function setMark(id: string, value: Mark) {
    setJustSaved(false);
    setMarks((m) => ({ ...m, [id]: m[id] === value ? null : value })); // tap again to un-mark
  }

  function bulk(fn: (current: Mark) => Mark) {
    setJustSaved(false);
    setMarks((m) => Object.fromEntries(students.map((s) => [s.id, fn(m[s.id] ?? null)])));
  }

  function save() {
    setError(null);
    const payload = { sessionId, marks: changed.map((s) => ({ studentId: s.id, status: marks[s.id] ?? null })) };
    startSaving(async () => {
      const res = await saveAttendance(payload);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(marks);
      setJustSaved(true);
      router.refresh();
    });
  }

  if (students.length === 0) {
    return (
      <Card>
        <EmptyState icon={UserX} title="No active students" description="Add students first, then mark their attendance here." />
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Summary */}
      <Card className="animate-fade-up p-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm tabular-nums">
          {STATUSES.map((s) => (
            <span key={s.value} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", s.dot)} aria-hidden />
              <span className="font-semibold">{counts[s.value]}</span>
              <span className="text-muted">{s.label.toLowerCase()}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full bg-line-strong" aria-hidden />
            <span className="font-semibold text-ink">{counts.unmarked}</span> not marked
          </span>
          <span className="ml-auto text-base font-semibold">{pct === null ? "—" : `${pct}%`}</span>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Students marked"
          aria-valuenow={Math.round(markedShare)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${markedShare}%` }} />
        </div>
      </Card>

      {/* Bulk actions + search */}
      <div className="flex animate-fade-up flex-col gap-2 sm:flex-row sm:items-center" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => bulk(() => "present")}>
            <CheckCheck className="size-4 text-success" aria-hidden />
            All present
          </Button>
          <Button variant="secondary" size="sm" onClick={() => bulk((m) => m ?? "absent")} disabled={counts.unmarked === 0}>
            <UserX className="size-4 text-danger" aria-hidden />
            Rest absent
          </Button>
          <Button variant="secondary" size="sm" onClick={() => bulk(() => null)} disabled={counts.unmarked === students.length}>
            <Eraser className="size-4" aria-hidden />
            Clear
          </Button>
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a student"
            aria-label="Find a student"
            className={cn(inputClass, "py-2 pl-9")}
          />
        </div>
      </div>

      {/* Students */}
      <Card className="animate-fade-up" style={{ animationDelay: "100ms" }}>
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">Nobody matches “{query}”.</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((s) => {
              const mark = marks[s.id] ?? null;
              const isChanged = (marks[s.id] ?? null) !== (saved[s.id] ?? null);
              return (
                <li key={s.id} className={cn("flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:px-5", isChanged && "bg-brand-soft/40")}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={s.full_name} className="size-9 text-xs" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {s.full_name}
                        {s.inactive && <Badge>Inactive</Badge>}
                      </p>
                      {s.student_code && <p className="font-mono text-xs text-muted">{s.student_code}</p>}
                    </div>
                  </div>
                  <div role="radiogroup" aria-label={`Attendance for ${s.full_name}`} className="grid grid-cols-4 gap-1.5 sm:w-[22rem]">
                    {STATUSES.map((st) => {
                      const active = mark === st.value;
                      return (
                        <button
                          key={st.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={st.label}
                          onClick={() => setMark(s.id, st.value)}
                          className={cn(
                            "h-10 rounded-lg border text-[13px] font-semibold transition-all active:scale-95",
                            active ? cn(st.active, "animate-pop shadow-card") : "border-line text-ink-2 hover:bg-surface-2",
                          )}
                        >
                          <span className="sm:hidden">{st.short}</span>
                          <span className="hidden sm:inline">{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Save bar (sits above the mobile bottom nav) */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-64">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur">
          <p className="min-w-0 flex-1 text-sm" role="status" aria-live="polite">
            {error ? (
              <span className="flex items-center gap-1.5 text-danger">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {error}
              </span>
            ) : dirty ? (
              <span className="font-medium">
                {changed.length} unsaved {changed.length === 1 ? "change" : "changes"}
              </span>
            ) : justSaved ? (
              <span className="flex items-center gap-1.5 font-medium text-success">
                <Check className="size-4 animate-pop" aria-hidden />
                Attendance saved
              </span>
            ) : (
              <span className="text-muted">All changes saved</span>
            )}
          </p>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? "Saving…" : "Save attendance"}
          </Button>
        </div>
      </div>
    </div>
  );
}
