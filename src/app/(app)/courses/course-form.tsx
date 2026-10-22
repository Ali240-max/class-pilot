"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import type { CourseRow } from "@/lib/database.types";
import type { FormState } from "@/lib/validation";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/client";
import { buttonClass } from "@/components/ui/button";
import { saveCourse } from "./actions";

export function CourseForm({ course }: { course?: CourseRow }) {
  const [state, action] = useActionState<FormState, FormData>(saveCourse, { ok: false });
  const v = state.values;
  const e = state.fieldErrors ?? {};

  return (
    <Card className="animate-fade-up p-5 sm:p-6">
      <form action={action} className="space-y-5" noValidate>
        {course && <input type="hidden" name="id" value={course.id} />}
        {state.message && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {state.message}
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
          <Field label="Course name" htmlFor="name" error={e.name}>
            <Input id="name" name="name" required maxLength={120} defaultValue={v?.name ?? course?.name} error={e.name} placeholder="e.g. Data Structures" />
          </Field>
          <Field label="Code" htmlFor="code" optional error={e.code}>
            <Input id="code" name="code" maxLength={30} defaultValue={v?.code ?? course?.code ?? ""} error={e.code} placeholder="CS-201" />
          </Field>
        </div>
        <Field label="Instructor" htmlFor="instructor_name" optional error={e.instructor_name}>
          <Input
            id="instructor_name"
            name="instructor_name"
            maxLength={120}
            defaultValue={v?.instructor_name ?? course?.instructor_name ?? ""}
            error={e.instructor_name}
            placeholder="e.g. Dr. Ali Naqvi"
          />
        </Field>
        <Field label="Description" htmlFor="description" optional error={e.description}>
          <Textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={v?.description ?? course?.description ?? ""} error={e.description} />
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={v?.status ?? course?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Link href={course ? `/courses/${course.id}` : "/courses"} className={buttonClass("secondary")}>
            Cancel
          </Link>
          <SubmitButton pendingText="Saving…">{course ? "Save changes" : "Create course"}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
