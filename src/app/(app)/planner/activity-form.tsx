"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { ActivityRow, ActivityType } from "@/lib/database.types";
import type { FormState } from "@/lib/validation";
import { isoToPktInput, pktInputToIso, formatDateTime } from "@/lib/time";
import { TYPE_LABEL } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/client";
import { buttonClass } from "@/components/ui/button";
import { TYPE_ICON } from "@/components/activity-icons";
import { saveActivity } from "./actions";

type CourseOption = { id: string; name: string; code: string | null };

export function ActivityForm({
  activity,
  courses,
  defaultCourseId,
  defaultDueInput,
}: {
  activity?: ActivityRow;
  courses: CourseOption[];
  defaultCourseId?: string;
  defaultDueInput: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveActivity, { ok: false });
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const [type, setType] = useState<ActivityType>((v?.type as ActivityType) || activity?.type || "assignment");
  const [due, setDue] = useState(v?.due_at ?? (activity ? isoToPktInput(activity.due_at) : defaultDueInput));
  const dueIso = pktInputToIso(due);

  return (
    <Card className="animate-fade-up p-5 sm:p-6">
      <form action={action} className="space-y-5" noValidate>
        {activity && <input type="hidden" name="id" value={activity.id} />}
        {state.message && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {state.message}
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Type</legend>
          <input type="hidden" name="type" value={type} />
          <div role="radiogroup" aria-label="Activity type" className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_LABEL) as ActivityType[]).map((t) => {
              const Icon = TYPE_ICON[t];
              const active = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-medium transition-all active:scale-[0.97]",
                    active ? "border-brand bg-brand-soft text-brand-ink ring-2 ring-brand/15" : "border-line text-ink-2 hover:bg-surface-2",
                  )}
                >
                  <Icon className={cn("size-5", active ? "text-brand" : "text-muted")} aria-hidden />
                  {TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Title" htmlFor="title" error={e.title}>
          <Input id="title" name="title" required maxLength={160} defaultValue={v?.title ?? activity?.title} error={e.title} placeholder={type === "quiz" ? "e.g. Quiz 2: Linked Lists" : type === "exam" ? "e.g. Midterm Exam" : "e.g. Assignment 3: Sorting"} />
        </Field>

        <Field label="Course" htmlFor="course_id" error={e.course_id}>
          <Select id="course_id" name="course_id" required defaultValue={v?.course_id ?? activity?.course_id ?? defaultCourseId ?? ""} error={e.course_id}>
            <option value="" disabled>
              Choose a course
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} — ${c.name}` : c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Due date & time (PKT)"
            htmlFor="due_at"
            error={e.due_at}
            hint={dueIso ? formatDateTime(dueIso) + " Pakistan time" : undefined}
          >
            <Input id="due_at" name="due_at" type="datetime-local" required value={due} onChange={(ev) => setDue(ev.target.value)} error={e.due_at} />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={v?.status ?? activity?.status ?? "scheduled"}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </div>

        <Field label="Details" htmlFor="description" optional error={e.description} hint="Syllabus, chapters, submission instructions… included in WhatsApp reminders.">
          <Textarea id="description" name="description" rows={4} maxLength={4000} defaultValue={v?.description ?? activity?.description ?? ""} error={e.description} />
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Link href="/planner" className={buttonClass("secondary")}>
            Cancel
          </Link>
          <SubmitButton pendingText="Saving…">{activity ? "Save changes" : `Add ${TYPE_LABEL[type].toLowerCase()}`}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
