import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Hash, MessageCircle, Pencil, Phone, StickyNote, Trash2 } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { uuidSchema } from "@/lib/validation";
import { formatPhone } from "@/lib/phone";
import { formatPlainDate } from "@/lib/time";
import { whatsappUrl } from "@/lib/whatsapp";
import type { AttendanceStatus } from "@/lib/database.types";
import { stagger } from "@/lib/cn";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/client";
import { BackLink } from "@/components/back-link";
import { ATTENDANCE_THRESHOLD, AttendancePill, Avatar } from "@/components/attendance-pill";
import { deleteStudent } from "../actions";

export const metadata: Metadata = { title: "Student" };

const STATUS_TONE: Record<AttendanceStatus, "success" | "danger" | "warning" | "info"> = {
  present: "success",
  absent: "danger",
  late: "warning",
  excused: "info",
};

export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requireOrganizer();

  const [studentRes, summaryRes, recordsRes] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).maybeSingle(),
    supabase.from("student_attendance_summary").select("*").eq("student_id", id).maybeSingle(),
    supabase
      .from("attendance_records")
      .select("id, status, session:attendance_sessions(id, session_date, course:courses(name, code))")
      .eq("student_id", id),
  ]);
  const student = studentRes.data;
  if (!student) notFound();
  const summary = summaryRes.data;
  const records = (recordsRes.data ?? [])
    .filter((r) => r.session)
    .sort((a, b) => (b.session?.session_date ?? "").localeCompare(a.session?.session_date ?? ""));

  const stats = [
    { label: "Present", value: summary?.present_count ?? 0, tone: "text-success" },
    { label: "Late", value: summary?.late_count ?? 0, tone: "text-warning" },
    { label: "Absent", value: summary?.absent_count ?? 0, tone: "text-danger" },
    { label: "Excused", value: summary?.excused_count ?? 0, tone: "text-info" },
  ];
  const pct = summary?.attendance_percent ?? null;

  return (
    <>
      <PageHeader
        back={<BackLink href="/students" label="Students" />}
        title={student.full_name}
        description={
          <span className="flex items-center gap-2">
            {student.status === "active" ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
            {student.student_code && <span className="font-mono">{student.student_code}</span>}
          </span>
        }
        actions={
          <>
            {student.phone && (
              <a href={whatsappUrl("", student.phone)} target="_blank" rel="noopener noreferrer" className={buttonClass("whatsapp")}>
                <MessageCircle className="size-4" aria-hidden />
                WhatsApp
              </a>
            )}
            <LinkButton href={`/students/${id}/edit`} variant="secondary">
              <Pencil className="size-4" aria-hidden />
              Edit
            </LinkButton>
            <ConfirmSubmit
              action={deleteStudent}
              hiddenFields={{ id }}
              label="Delete"
              icon={<Trash2 className="size-4" aria-hidden />}
              confirmTitle="Delete student?"
              confirmText={`This permanently removes ${student.full_name} and their attendance history. This can't be undone. To keep their history, mark them inactive instead.`}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="stagger space-y-4">
          <Card className="p-5" style={stagger(0)}>
            <div className="flex items-center gap-3">
              <Avatar name={student.full_name} className="size-14 text-lg" />
              <div>
                <p className="text-sm text-muted">Attendance</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">{pct === null ? "—" : `${pct}%`}</span>
                  <AttendancePill percent={pct} />
                </div>
              </div>
            </div>
            {pct !== null && (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Attendance">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${pct >= ATTENDANCE_THRESHOLD ? "bg-success" : pct >= 60 ? "bg-warning" : "bg-danger"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl bg-surface-2 py-2">
                  <dt className="text-[11px] text-muted">{s.label}</dt>
                  <dd className={`text-lg font-semibold tabular-nums ${s.tone}`}>{s.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted">
              Counted over {summary?.counted_sessions ?? 0} sessions (excused not counted).
            </p>
          </Card>

          <Card className="divide-y divide-line" style={stagger(1)}>
            {[
              { icon: Hash, label: "Student ID", value: student.student_code },
              { icon: Phone, label: "Phone", value: formatPhone(student.phone) },
              { icon: StickyNote, label: "Notes", value: student.notes },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3 px-5 py-3.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-sm break-words whitespace-pre-wrap text-ink">{value || <span className="text-muted">—</span>}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <Card className="animate-fade-up self-start" style={{ animationDelay: "90ms" }}>
          <CardHeader title="Attendance history" icon={CalendarCheck} />
          {records.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No attendance yet" description="Sessions this student is marked in will appear here." />
          ) : (
            <ul className="divide-y divide-line">
              {records.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/attendance/${r.session!.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors last:rounded-b-2xl hover:bg-surface-2 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatPlainDate(r.session!.session_date)}</p>
                      <p className="truncate text-xs text-muted">{r.session!.course?.name ?? "General session"}</p>
                    </div>
                    <Badge tone={STATUS_TONE[r.status]} className="capitalize">
                      {r.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
