import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { uuidSchema } from "@/lib/validation";
import { PageHeader } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { CourseForm } from "../../course-form";

export const metadata: Metadata = { title: "Edit course" };

export default async function EditCoursePage({ params }: PageProps<"/courses/[id]/edit">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requireOrganizer();
  const { data: course } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit course" back={<BackLink href={`/courses/${id}`} label={course.name} />} />
      <CourseForm course={course} />
    </div>
  );
}
