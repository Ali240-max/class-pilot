import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarClock, FolderOpen, Plus, UserRound } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { stagger } from "@/lib/cn";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { FilterTabs } from "@/components/filter-tabs";

export const metadata: Metadata = { title: "Courses" };

export default async function CoursesPage({ searchParams }: PageProps<"/courses">) {
  const sp = await searchParams;
  const status = sp.status === "archived" ? "archived" : "active";
  const { supabase } = await requireOrganizer();

  const [coursesRes, actsRes, matsRes] = await Promise.all([
    supabase.from("courses").select("*").order("name"),
    supabase.from("academic_activities").select("course_id, due_at, status").eq("status", "scheduled").gte("due_at", new Date().toISOString()),
    supabase.from("materials").select("course_id"),
  ]);
  const courses = must(coursesRes, "courses");
  const upcoming = new Map<string, number>();
  for (const a of actsRes.data ?? []) upcoming.set(a.course_id, (upcoming.get(a.course_id) ?? 0) + 1);
  const materials = new Map<string, number>();
  for (const m of matsRes.data ?? []) materials.set(m.course_id, (materials.get(m.course_id) ?? 0) + 1);

  const shown = courses.filter((c) => c.status === status);

  return (
    <>
      <PageHeader
        title="Courses"
        description={`${courses.filter((c) => c.status === "active").length} active this semester`}
        actions={
          <LinkButton href="/courses/new">
            <Plus className="size-4" aria-hidden />
            New course
          </LinkButton>
        }
      />
      <div className="mb-4 animate-fade-up">
        <div className="w-fit">
          <FilterTabs
            label="Filter courses"
            param="status"
            current={status}
            basePath="/courses"
            searchParams={sp}
            options={[
              { value: "active", label: "Active", count: courses.filter((c) => c.status === "active").length },
              { value: "archived", label: "Archived", count: courses.filter((c) => c.status === "archived").length },
            ]}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title={status === "archived" ? "No archived courses" : "No courses yet"}
            description={status === "archived" ? undefined : "Add the courses you're taking this semester."}
            action={
              status === "active" && (
                <LinkButton href="/courses/new">
                  <Plus className="size-4" aria-hidden /> Add a course
                </LinkButton>
              )
            }
          />
        </Card>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c, i) => (
            <Link key={c.id} href={`/courses/${c.id}`} style={stagger(i)} className="group">
              <Card className="h-full p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <BookOpen className="size-5" aria-hidden />
                  </span>
                  {c.code && <Badge className="font-mono">{c.code}</Badge>}
                </div>
                <h2 className="mt-4 text-[15px] font-semibold text-ink">{c.name}</h2>
                {c.instructor_name && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <UserRound className="size-3.5" aria-hidden />
                    {c.instructor_name}
                  </p>
                )}
                <div className="mt-4 flex gap-4 border-t border-line pt-3 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" aria-hidden />
                    {upcoming.get(c.id) ?? 0} upcoming
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="size-3.5" aria-hidden />
                    {materials.get(c.id) ?? 0} materials
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
