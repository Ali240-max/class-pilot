import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  FileText,
  Megaphone,
  MessageCircle,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { deadlineChecks } from "@/lib/activities";
import { formatDate, formatLongDate, pktDayStart, pktToday } from "@/lib/time";
import { buildDigestMessage } from "@/lib/whatsapp";
import { stagger } from "@/lib/cn";
import { Card, CardHeader, EmptyState, StatCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ShareButton } from "@/components/share-dialog";
import { ActivityItem, type ActivityListItem } from "@/components/activity-item";
import { ATTENDANCE_THRESHOLD, AttendancePill, Avatar } from "@/components/attendance-pill";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(): string {
  const hour = (new Date().getUTCHours() + 5) % 24; // PKT
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const { supabase } = await requireOrganizer();
  const today = pktToday();

  const [profileRes, studentsRes, coursesRes, actsRes, summaryRes, sessionsRes, materialsRes, announcementsRes] = await Promise.all([
    supabase.from("organizers").select("full_name, class_name").maybeSingle(),
    supabase.from("students").select("id, full_name, status"),
    supabase.from("courses").select("id, status"),
    supabase
      .from("academic_activities")
      .select("id, title, type, due_at, status, description, course:courses(id, name, code)")
      .eq("status", "scheduled")
      .lte("due_at", pktDayStart(30).toISOString())
      .order("due_at"),
    supabase.from("student_attendance_summary").select("student_id, attendance_percent"),
    supabase.from("attendance_sessions").select("id, course:courses(name, code)").eq("session_date", today),
    supabase.from("materials").select("id, title, file_name, created_at, course:courses(name, code)").order("created_at", { ascending: false }).limit(4),
    supabase.from("announcements").select("id, title, created_at").order("created_at", { ascending: false }).limit(3),
  ]);

  const students = must(studentsRes, "students");
  const active = students.filter((s) => s.status === "active");
  const courses = must(coursesRes, "courses");
  const acts: ActivityListItem[] = must(actsRes, "activities");
  const { isUpcoming, isOverdue, dueBefore } = deadlineChecks();
  const upcoming = acts.filter(isUpcoming);
  const overdue = acts.filter(isOverdue);
  const thisWeek = upcoming.filter((a) => dueBefore(a, pktDayStart(7)));
  const todayAndTomorrow = upcoming.filter((a) => dueBefore(a, pktDayStart(2)));

  const pct = new Map((summaryRes.data ?? []).map((s) => [s.student_id, s.attendance_percent]));
  const low = active
    .map((s) => ({ ...s, pct: pct.get(s.id) ?? null }))
    .filter((s): s is typeof s & { pct: number } => s.pct !== null && s.pct < ATTENDANCE_THRESHOLD)
    .sort((a, b) => a.pct - b.pct);

  // Today's attendance (across today's sessions).
  const sessionIds = (sessionsRes.data ?? []).map((s) => s.id);
  let todayPresent = 0;
  let todayMarked = 0;
  if (sessionIds.length) {
    const { data: recs } = await supabase.from("attendance_records").select("status").in("session_id", sessionIds);
    todayMarked = recs?.length ?? 0;
    todayPresent = recs?.filter((r) => r.status === "present" || r.status === "late").length ?? 0;
  }

  const reminder = buildDigestMessage(`⏰ Reminder: due today & tomorrow (${formatLongDate(new Date())})`, todayAndTomorrow);
  const profile = profileRes.data;
  const materials = materialsRes.data ?? [];
  const announcements = announcementsRes.data ?? [];

  return (
    <>
      <header className="mb-6 animate-fade-up">
        <p className="text-sm text-muted">{formatLongDate(new Date())}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-[28px]">
          {greeting()}
          {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        {profile?.class_name && <p className="mt-1 text-sm text-muted">{profile.class_name}</p>}
      </header>

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard style={stagger(0)} label="Students" value={active.length} sub={`${students.length - active.length} inactive`} icon={Users} />
        <StatCard style={stagger(1)} label="Courses" value={courses.filter((c) => c.status === "active").length} sub="active" icon={BookOpen} tone="info" />
        <StatCard
          style={stagger(2)}
          label="Today's attendance"
          value={todayMarked ? `${Math.round((100 * todayPresent) / todayMarked)}%` : "—"}
          sub={todayMarked ? `${todayPresent} of ${todayMarked} present` : sessionIds.length ? "Session not marked" : "No session today"}
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard
          style={stagger(3)}
          label="Due this week"
          value={thisWeek.length}
          sub={overdue.length ? `${overdue.length} overdue` : "Nothing overdue"}
          icon={CalendarClock}
          tone={overdue.length ? "danger" : "warning"}
        />
      </div>

      <div className="mt-4 grid animate-fade-up grid-cols-2 gap-2 sm:grid-cols-4" style={{ animationDelay: "200ms" }}>
        <LinkButton href="/attendance/new" variant="secondary" className="h-auto flex-col gap-1.5 py-3.5">
          <CalendarCheck className="size-5 text-success" aria-hidden />
          Mark attendance
        </LinkButton>
        <LinkButton href="/planner/new" variant="secondary" className="h-auto flex-col gap-1.5 py-3.5">
          <Plus className="size-5 text-brand" aria-hidden />
          Add assignment
        </LinkButton>
        <div className="[&>button]:h-full [&>button]:w-full [&>button]:flex-col [&>button]:gap-1.5 [&>button]:py-3.5">
          <ShareButton message={reminder} title="Class reminder" label="WhatsApp reminder" size="md" icon={<MessageCircle className="size-5 text-[#1fa855]" aria-hidden />} />
        </div>
        <LinkButton href="/assistant" variant="secondary" className="h-auto flex-col gap-1.5 py-3.5">
          <Sparkles className="size-5 text-brand" aria-hidden />
          Ask AI
        </LinkButton>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {overdue.length > 0 && (
            <Card className="animate-fade-up border-danger/30" style={{ animationDelay: "240ms" }}>
              <CardHeader
                title={`Overdue (${overdue.length})`}
                icon={AlertTriangle}
                action={
                  <Link href="/planner?view=overdue" className="text-[13px] font-medium text-brand hover:underline">
                    Review
                  </Link>
                }
              />
              <div className="divide-y divide-line">
                {overdue.slice(0, 3).map((a) => (
                  <ActivityItem key={a.id} activity={a} compact />
                ))}
              </div>
            </Card>
          )}

          <Card className="animate-fade-up" style={{ animationDelay: "280ms" }}>
            <CardHeader
              title="Upcoming deadlines"
              icon={CalendarClock}
              action={
                <Link href="/planner" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                  Planner <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            />
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No upcoming deadlines"
                description="Add assignments, quizzes and exams to see them here."
                action={
                  <LinkButton href="/planner/new" size="sm">
                    <Plus className="size-4" aria-hidden /> Add activity
                  </LinkButton>
                }
              />
            ) : (
              <div className="divide-y divide-line">
                {upcoming.slice(0, 6).map((a) => (
                  <ActivityItem key={a.id} activity={a} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="animate-fade-up" style={{ animationDelay: "320ms" }}>
            <CardHeader
              title={`Below ${ATTENDANCE_THRESHOLD}% attendance`}
              icon={Users}
              action={
                low.length > 0 && (
                  <Link href="/students?status=low" className="text-[13px] font-medium text-brand hover:underline">
                    View all
                  </Link>
                )
              }
            />
            {low.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Everyone is at or above {ATTENDANCE_THRESHOLD}%. 🎉</p>
            ) : (
              <ul className="divide-y divide-line pb-1">
                {low.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    <Link href={`/students/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 sm:px-5">
                      <Avatar name={s.full_name} className="size-8 text-xs" />
                      <span className="flex-1 truncate text-sm">{s.full_name}</span>
                      <AttendancePill percent={s.pct} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="animate-fade-up" style={{ animationDelay: "360ms" }}>
            <CardHeader title="Recent materials" icon={FileText} />
            {materials.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">No materials uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-line pb-1">
                {materials.map((m) => (
                  <li key={m.id} className="px-4 py-2.5 sm:px-5">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="truncate text-xs text-muted">
                      {m.course?.code ?? m.course?.name} · {formatDate(m.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {announcements.length > 0 && (
            <Card className="animate-fade-up" style={{ animationDelay: "400ms" }}>
              <CardHeader title="Recent announcements" icon={Megaphone} />
              <ul className="divide-y divide-line pb-1">
                {announcements.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 sm:px-5">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted">{formatDate(a.created_at)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
