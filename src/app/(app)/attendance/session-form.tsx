"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import type { FormState } from "@/lib/validation";
import { formatPlainDate } from "@/lib/time";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/client";
import { buttonClass } from "@/components/ui/button";
import { saveSession } from "./actions";

type CourseOption = { id: string; name: string; code: string | null };
type SessionValues = { id: string; session_date: string; course_id: string | null; notes: string | null };

export function SessionForm({
  courses,
  session,
  today,
  defaultCourseId,
  onCancel,
}: {
  courses: CourseOption[];
  session?: SessionValues;
  today: string;
  defaultCourseId?: string;
  /** When shown in a dialog, Cancel closes it instead of navigating. */
  onCancel?: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveSession, { ok: false });
  const v = state.values;
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5" noValidate>
      {session && <input type="hidden" name="id" value={session.id} />}
      {state.message && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </div>
      )}
      <Field label="Date" htmlFor="session_date" error={e.session_date} hint={`Today is ${formatPlainDate(today)}`}>
        <Input
          id="session_date"
          name="session_date"
          type="date"
          required
          max={today}
          defaultValue={v?.session_date ?? session?.session_date ?? today}
          error={e.session_date}
        />
      </Field>
      <Field label="Course" htmlFor="course_id" optional error={e.course_id}>
        <Select id="course_id" name="course_id" defaultValue={v?.course_id ?? session?.course_id ?? defaultCourseId ?? ""} error={e.course_id}>
          <option value="">General session (no course)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code ? `${c.code} — ${c.name}` : c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Notes" htmlFor="notes" optional error={e.notes}>
        <Textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={v?.notes ?? session?.notes ?? ""} error={e.notes} placeholder="e.g. Lab session, room B-14" />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonClass("secondary")}>
            Cancel
          </button>
        ) : (
          <Link href="/attendance" className={buttonClass("secondary")}>
            Cancel
          </Link>
        )}
        <SubmitButton pendingText={session ? "Saving…" : "Opening…"}>{session ? "Save details" : "Start marking"}</SubmitButton>
      </div>
    </form>
  );
}
