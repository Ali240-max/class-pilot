import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { CourseForm } from "../course-form";

export const metadata: Metadata = { title: "New course" };

export default function NewCoursePage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New course" back={<BackLink href="/courses" label="Courses" />} />
      <CourseForm />
    </div>
  );
}
