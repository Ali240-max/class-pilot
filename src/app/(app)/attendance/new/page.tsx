import type { Metadata } from "next";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { pktToday } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui/card";
import { BackLink } from "@/components/back-link";
import { SessionForm } from "../session-form";

export const metadata: Metadata = { title: "New attendance session" };

export default async function NewSessionPage({ searchParams }: PageProps<"/attendance/new">) {
  const sp = await searchParams;
  const { supabase } = await requireOrganizer();
  const courses = must(await supabase.from("courses").select("id, name, code").eq("status", "active").order("name"), "courses");
  const preselect = typeof sp.course === "string" && courses.some((c) => c.id === sp.course) ? sp.course : undefined;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Mark attendance"
        description="Pick the class. If a session already exists for that date and course, it opens for editing."
        back={<BackLink href="/attendance" label="Attendance" />}
      />
      <Card className="animate-fade-up p-5 sm:p-6">
        <SessionForm courses={courses} today={pktToday()} defaultCourseId={preselect} />
      </Card>
    </div>
  );
}
