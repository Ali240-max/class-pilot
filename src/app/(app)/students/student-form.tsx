"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import type { StudentRow } from "@/lib/database.types";
import { formatPhone } from "@/lib/phone";
import type { FormState } from "@/lib/validation";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/client";
import { buttonClass } from "@/components/ui/button";
import { saveStudent } from "./actions";

export function StudentForm({ student }: { student?: StudentRow }) {
  const [state, action] = useActionState<FormState, FormData>(saveStudent, { ok: false });
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const cancelHref = student ? `/students/${student.id}` : "/students";

  return (
    <Card className="animate-fade-up p-5 sm:p-6">
      <form action={action} className="space-y-5" noValidate>
        {student && <input type="hidden" name="id" value={student.id} />}
        {state.message && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {state.message}
          </div>
        )}

        <Field label="Full name" htmlFor="full_name" error={e.full_name}>
          <Input
            id="full_name"
            name="full_name"
            required
            maxLength={120}
            autoComplete="off"
            defaultValue={v?.full_name ?? student?.full_name}
            error={e.full_name}
            placeholder="e.g. Sakina Raza"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Student ID" htmlFor="student_code" optional error={e.student_code} hint="Roll number or registration ID. Must be unique.">
            <Input
              id="student_code"
              name="student_code"
              maxLength={40}
              autoComplete="off"
              defaultValue={v?.student_code ?? student?.student_code ?? ""}
              error={e.student_code}
              placeholder="e.g. BSCS-24-017"
            />
          </Field>
          <Field label="Phone" htmlFor="phone" optional error={e.phone} hint="Used only for WhatsApp. Never shared with the AI.">
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              defaultValue={v?.phone ?? formatPhone(student?.phone)}
              error={e.phone}
              placeholder="0300-1234567"
            />
          </Field>
        </div>

        <Field label="Status" htmlFor="status" error={e.status}>
          <Select id="status" name="status" defaultValue={v?.status ?? student?.status ?? "active"} error={e.status}>
            <option value="active">Active</option>
            <option value="inactive">Inactive (left or not attending)</option>
          </Select>
        </Field>

        <Field label="Notes" htmlFor="notes" optional error={e.notes}>
          <Textarea id="notes" name="notes" maxLength={2000} rows={3} defaultValue={v?.notes ?? student?.notes ?? ""} error={e.notes} />
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Link href={cancelHref} className={buttonClass("secondary")}>
            Cancel
          </Link>
          <SubmitButton pendingText="Saving…">{student ? "Save changes" : "Add student"}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
