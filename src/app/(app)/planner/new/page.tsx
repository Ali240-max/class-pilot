import type { Metadata } from "next";
import { BookOpen, Plus } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { pktToday } from "@/lib/time";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { ActivityForm } from "../activity-form";

export const metadata: Metadata = { title: "Add activity" };

/** Tomorrow at 9:00 AM PKT, as a datetime-local value. */
function defaultDue(): string {
  const [y, m, d] = pktToday().split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.toISOString().slice(0, 10)}T09:00`;
}

export default async function NewActivityPage({ searchParams }: PageProps<"/planner/new">) {
  const sp = await searchParams;
  const { supabase } = await requireOrganizer();
  const courses = must(await supabase.from("courses").select("id, name, code").eq("status", "active").order("name"), "courses");
  const preselect = typeof sp.course === "string" && courses.some((c) => c.id === sp.course) ? sp.course : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add to planner" back={<BackLink href="/planner" label="Planner" />} />
      {courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Create a course first"
            description="Every assignment, quiz and exam belongs to a course."
            action={
              <LinkButton href="/courses/new">
                <Plus className="size-4" aria-hidden />
                New course
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <ActivityForm courses={courses} defaultCourseId={preselect} defaultDueInput={defaultDue()} />
      )}
    </div>
  );
}
