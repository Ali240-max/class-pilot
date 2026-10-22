import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { uuidSchema } from "@/lib/validation";
import { formatPlainDate, pktToday } from "@/lib/time";
import type { AttendanceStatus } from "@/lib/database.types";
import { PageHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/client";
import { BackLink } from "@/components/back-link";
import { deleteSession } from "../actions";
import { AttendanceMarker, type MarkerStudent } from "./marker";
import { EditSessionButton } from "./edit-session";

export const metadata: Metadata = { title: "Mark attendance" };

export default async function SessionPage({ params }: PageProps<"/attendance/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requireOrganizer();

  const [sessionRes, studentsRes, recordsRes, coursesRes] = await Promise.all([
    supabase.from("attendance_sessions").select("id, session_date, course_id, notes, course:courses(name, code)").eq("id", id).maybeSingle(),
    supabase.from("students").select("id, full_name, student_code, status").order("full_name"),
    supabase.from("attendance_records").select("student_id, status").eq("session_id", id),
    supabase.from("courses").select("id, name, code, status").order("name"),
  ]);
  const session = sessionRes.data;
  if (!session) notFound();

  const records = must(recordsRes, "attendance");
  const initial: Record<string, AttendanceStatus> = Object.fromEntries(records.map((r) => [r.student_id, r.status]));
  // Active students, plus inactive ones who already have a mark in this session.
  const students: MarkerStudent[] = must(studentsRes, "students")
    .filter((s) => s.status === "active" || s.id in initial)
    .map((s) => ({ id: s.id, full_name: s.full_name, student_code: s.student_code, inactive: s.status === "inactive" }));
  const courses = must(coursesRes, "courses").filter((c) => c.status === "active" || c.id === session.course_id);
  const courseLabel = session.course ? (session.course.code ? `${session.course.code} — ${session.course.name}` : session.course.name) : "General session";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackLink href="/attendance" label="Attendance" />}
        title={formatPlainDate(session.session_date)}
        description={
          <>
            {courseLabel}
            {session.notes && <span className="block text-xs">{session.notes}</span>}
          </>
        }
        actions={
          <>
            <EditSessionButton
              session={{ id: session.id, session_date: session.session_date, course_id: session.course_id, notes: session.notes }}
              courses={courses}
              today={pktToday()}
            />
            <ConfirmSubmit
              action={deleteSession}
              hiddenFields={{ id: session.id }}
              label="Delete"
              icon={<Trash2 className="size-4" aria-hidden />}
              confirmTitle="Delete this session?"
              confirmText="All marks in this session will be removed and students' percentages recalculated. This can't be undone."
            />
          </>
        }
      />
      <AttendanceMarker key={session.id} sessionId={session.id} students={students} initial={initial} />
    </div>
  );
}
