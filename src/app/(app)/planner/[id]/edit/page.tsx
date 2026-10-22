import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { uuidSchema } from "@/lib/validation";
import { isoToPktInput } from "@/lib/time";
import { PageHeader } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/ui/client";
import { BackLink } from "@/components/back-link";
import { ActivityForm } from "../../activity-form";
import { deleteActivity } from "../../actions";

export const metadata: Metadata = { title: "Edit activity" };

export default async function EditActivityPage({ params }: PageProps<"/planner/[id]/edit">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requireOrganizer();
  const [actRes, coursesRes] = await Promise.all([
    supabase.from("academic_activities").select("*").eq("id", id).maybeSingle(),
    supabase.from("courses").select("id, name, code, status").order("name"),
  ]);
  const activity = actRes.data;
  if (!activity) notFound();
  // Archived courses only appear if this activity already uses them.
  const courses = must(coursesRes, "courses").filter((c) => c.status === "active" || c.id === activity.course_id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Edit activity"
        back={<BackLink href="/planner" label="Planner" />}
        actions={
          <ConfirmSubmit
            action={deleteActivity}
            hiddenFields={{ id }}
            label="Delete"
            icon={<Trash2 className="size-4" aria-hidden />}
            confirmTitle="Delete this activity?"
            confirmText={`“${activity.title}” will be removed from the planner. Materials linked to it stay in their course.`}
          />
        }
      />
      <ActivityForm activity={activity} courses={courses} defaultDueInput={isoToPktInput(activity.due_at)} />
    </div>
  );
}
