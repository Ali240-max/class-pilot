"use client";

import { useActionState } from "react";
import { AlertCircle, LogIn, Sparkles } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/client";
import { signIn, signInDemo, type LoginState } from "./actions";

export function LoginForm({ next, demoEnabled }: { next: string; demoEnabled: boolean }) {
  const [state, action] = useActionState<LoginState, FormData>(signIn, {});
  const [demoState, demoAction] = useActionState<LoginState, FormData>(signInDemo, {});
  const error = state.error ?? demoState.error;

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert" className="flex animate-fade-in items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {demoEnabled && (
        <form action={demoAction} className="space-y-2">
          <input type="hidden" name="next" value={next} />
          <SubmitButton size="lg" className="w-full" pendingText="Opening demo…">
            <Sparkles className="size-4" aria-hidden />
            Continue with demo account
          </SubmitButton>
          <p className="text-center text-xs text-muted">Sample CR account preloaded with demo class data.</p>
        </form>
      )}

      {demoEnabled && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          or sign in with email
          <span className="h-px flex-1 bg-line" />
        </div>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={6} />
        </Field>
        <SubmitButton variant={demoEnabled ? "secondary" : "primary"} size="lg" className="w-full" pendingText="Signing in…">
          <LogIn className="size-4" aria-hidden />
          Sign in
        </SubmitButton>
      </form>
    </div>
  );
}
