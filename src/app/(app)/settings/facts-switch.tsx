"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";
import { setShowDatabaseFacts } from "./actions";

function SwitchButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  // While saving, show the new position right away.
  const on = pending ? !enabled : enabled;
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={on}
      aria-labelledby="facts-switch-label"
      aria-describedby="facts-switch-desc"
      disabled={pending}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
        on ? "bg-brand" : "bg-line-strong",
        pending && "opacity-70",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow-card transition-transform duration-200",
          on ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

export function FactsSwitch({ enabled }: { enabled: boolean }) {
  return (
    <form action={setShowDatabaseFacts} className="flex items-center gap-4 px-5 pb-5">
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      <div className="min-w-0 flex-1">
        <p id="facts-switch-label" className="text-sm font-medium">
          Show database answer
        </p>
        <p id="facts-switch-desc" className="mt-0.5 text-xs text-muted">
          Shows the raw records the AI used (deadlines, attendance, files) above each AI answer. If the AI is unavailable, they&apos;re shown
          anyway.
        </p>
      </div>
      <SwitchButton enabled={enabled} />
    </form>
  );
}
