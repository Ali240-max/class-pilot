import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, ChevronRight, Plus } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { fetchRecordsForSessions } from "@/lib/attendance";
import { formatPlainDate, pktToday } from "@/lib/time";
import { stagger } from "@/lib/cn";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage() {
  const { supabase } = await requireOrganizer();
  const [sessionsRes, activeRes] = await Promise.all([
    supabase.from("attendance_sessions").select("id, session_date, notes, course:courses(name, code)").order("session_date", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  const sessions = must(sessionsRes, "attendance sessions");
  const activeCount = activeRes.count ?? 0;

  const records = await fetchRecordsForSessions(supabase, sessions.map((s) => s.id));

  const tally = new Map<string, Record<string, number>>();
  for (const r of records) {
    const t = tally.get(r.session_id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
    t[r.status] += 1;
    tally.set(r.session_id, t);
  }
  const today = pktToday();

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Tap a session to mark or correct it. Percentages count present + late; excused isn't counted."
        actions={
          <LinkButton href="/attendance/new">
            <Plus className="size-4" aria-hidden />
            Mark attendance
          </LinkButton>
        }
      />
      <Card>
        {sessions.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No sessions yet"
            description="Start a session for today's class and mark everyone in a few taps."
            action={
              <LinkButton href="/attendance/new">
                <Plus className="size-4" aria-hidden />
                Mark today&apos;s attendance
              </LinkButton>
            }
          />
        ) : (
          <ul className="stagger divide-y divide-line">
            {sessions.map((s, i) => {
              const t = tally.get(s.id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
              const marked = t.present + t.late + t.absent + t.excused;
              const counted = t.present + t.late + t.absent;
              const pct = counted ? Math.round((100 * (t.present + t.late)) / counted) : null;
              return (
                <li key={s.id} style={stagger(Math.min(i, 12))}>
                  <Link
                    href={`/attendance/${s.id}`}
                    className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-2 sm:px-5"
                  >
                    <div className="min-w-40 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {formatPlainDate(s.session_date)}
                        {s.session_date === today && <Badge tone="brand">Today</Badge>}
                        {marked === 0 ? (
                          <Badge tone="warning">Not marked</Badge>
                        ) : (
                          marked < activeCount && <Badge>{activeCount - marked} unmarked</Badge>
                        )}
                      </p>
                      <p className="mt-1 flex min-w-0 items-center gap-1.5">
                        {s.course ? (
                          <>
                            <Badge tone="brand" className="max-w-full truncate">
                              {s.course.name}
                            </Badge>
                            {s.course.code && <span className="font-mono text-[11px] text-muted">{s.course.code}</span>}
                          </>
                        ) : (
                          <Badge>General session</Badge>
                        )}
                      </p>
                    </div>
                    {/* Counts, % and arrow stay on one row (full width on phones). */}
                    <div className="flex w-full items-center gap-3 sm:w-auto sm:gap-4">
                      <div className="flex flex-1 gap-3 text-xs tabular-nums">
                        <span className="text-success">{t.present} present</span>
                        <span className="text-warning">{t.late} late</span>
                        <span className="text-danger">{t.absent} absent</span>
                        <span className="text-info">{t.excused} excused</span>
                      </div>
                      <span className="w-12 text-right text-sm font-semibold tabular-nums">{pct === null ? "—" : `${pct}%`}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
