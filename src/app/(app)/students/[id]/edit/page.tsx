import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganizer } from "@/lib/auth";
import { uuidSchema } from "@/lib/validation";
import { PageHeader } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { StudentForm } from "../../student-form";

export const metadata: Metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { supabase } = await requireOrganizer();
  const { data: student } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (!student) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit student" back={<BackLink href={`/students/${id}`} label={student.full_name} />} />
      <StudentForm student={student} />
    </div>
  );
}
