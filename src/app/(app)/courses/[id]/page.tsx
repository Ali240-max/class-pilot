import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, CalendarClock, FileText, FolderOpen, Pencil, Plus, UserRound } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { uuidSchema } from "@/lib/validation";
import { formatDate } from "@/lib/time";
import { deadlineChecks } from "@/lib/activities";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client";
import { BackLink } from "@/components/back-link";
import { ActivityItem } from "@/components/activity-item";
import { setCourseArchived } from "../actions";

export const metadata: Metadata = { title: "Course" };

export default async function CoursePage({ params }: PageProps<"/courses/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requireOrganizer();

  const [courseRes, actsRes, matsRes] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).maybeSingle(),
    supabase.from("academic_activities").select("id, title, type, due_at, status, description").eq("course_id", id).order("due_at"),
    supabase.from("materials").select("id, title, file_name, created_at").eq("course_id", id).order("created_at", { ascending: false }),
  ]);
  const course = courseRes.data;
  if (!course) notFound();

  const courseRef = { id: course.id, name: course.name, code: course.code };
  const { isUpcoming } = deadlineChecks();
  const acts = (actsRes.data ?? []).map((a) => ({ ...a, course: courseRef }));
  const upcoming = acts.filter(isUpcoming);
  const past = acts.filter((a) => !upcoming.includes(a)).reverse();
  const mats = matsRes.data ?? [];
  const archived = course.status === "archived";

  return (
    <>
      <PageHeader
        back={<BackLink href="/courses" label="Courses" />}
        title={course.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {course.code && <Badge className="font-mono">{course.code}</Badge>}
            {archived && <Badge tone="warning">Archived</Badge>}
            {course.instructor_name && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" aria-hidden />
                {course.instructor_name}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {!archived && (
              <LinkButton href={`/planner/new?course=${course.id}`}>
                <Plus className="size-4" aria-hidden />
                Add activity
              </LinkButton>
            )}
            <LinkButton href={`/courses/${course.id}/edit`} variant="secondary">
              <Pencil className="size-4" aria-hidden />
              Edit
            </LinkButton>
            <form action={setCourseArchived}>
              <input type="hidden" name="id" value={course.id} />
              <input type="hidden" name="archive" value={archived ? "false" : "true"} />
              <SubmitButton variant="secondary" pendingText="Saving…">
                {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                {archived ? "Restore" : "Archive"}
              </SubmitButton>
            </form>
          </>
        }
      />

      {course.description && <p className="mb-6 max-w-3xl animate-fade-up text-sm whitespace-pre-wrap text-ink-2">{course.description}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="animate-fade-up">
            <CardHeader title={`Upcoming (${upcoming.length})`} icon={CalendarClock} />
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nothing upcoming" description="Assignments, quizzes and exams for this course appear here." />
            ) : (
              <div className="divide-y divide-line">
                {upcoming.map((a) => (
                  <ActivityItem key={a.id} activity={a} showCourse={false} />
                ))}
              </div>
            )}
          </Card>
          {past.length > 0 && (
            <Card className="animate-fade-up" style={{ animationDelay: "80ms" }}>
              <CardHeader title={`Past & completed (${past.length})`} />
              <div className="divide-y divide-line">
                {past.map((a) => (
                  <ActivityItem key={a.id} activity={a} showCourse={false} />
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card className="animate-fade-up self-start" style={{ animationDelay: "120ms" }}>
          <CardHeader title="Materials" icon={FolderOpen} />
          {mats.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No materials" description="Uploaded notes and slides for this course will show here." />
          ) : (
            <ul className="divide-y divide-line">
              {mats.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <FileText className="size-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="truncate text-xs text-muted">
                      {m.file_name} · {formatDate(m.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
