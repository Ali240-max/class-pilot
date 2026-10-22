import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Add student" };

export default function NewStudentPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add student" back={<BackLink href="/students" label="Students" />} />
      <StudentForm />
    </div>
  );
}
