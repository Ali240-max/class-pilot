"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/client";
import { saveProfile } from "./actions";

type Profile = { full_name: string; class_name: string; institution: string };

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<FormState, FormData>(saveProfile, { ok: false });
  const v = state.values;
  const e = state.fieldErrors ?? {};
  return (
    <Card className="animate-fade-up">
      <CardHeader title="Profile & class" />
      <form action={action} className="space-y-4 px-5 pb-5">
        {state.message && <p role="alert" className="text-sm text-danger">{state.message}</p>}
        <Field label="Your name" htmlFor="full_name" error={e.full_name}>
          <Input id="full_name" name="full_name" maxLength={120} defaultValue={v?.full_name ?? profile.full_name} error={e.full_name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class" htmlFor="class_name" error={e.class_name}>
            <Input id="class_name" name="class_name" maxLength={120} defaultValue={v?.class_name ?? profile.class_name} error={e.class_name} placeholder="BSCS 5th Semester — Section A" />
          </Field>
          <Field label="Institution" htmlFor="institution" error={e.institution}>
            <Input id="institution" name="institution" maxLength={160} defaultValue={v?.institution ?? profile.institution} error={e.institution} />
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
