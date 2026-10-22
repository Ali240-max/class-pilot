"use client";

import { useFormStatus } from "react-dom";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { setTheme } from "./actions";

type Theme = "system" | "light" | "dark";

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function Options({ current }: { current: Theme }) {
  const { pending, data } = useFormStatus();
  // While saving, highlight the option that was just tapped.
  const selected = pending && typeof data?.get("theme") === "string" ? (data.get("theme") as Theme) : current;
  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === selected;
        return (
          <button
            key={value}
            type="submit"
            name="theme"
            value={value}
            role="radio"
            aria-checked={active}
            disabled={pending}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-medium transition-all active:scale-[0.97]",
              active ? "border-brand bg-brand-soft text-brand-ink ring-2 ring-brand/15" : "border-line text-ink-2 hover:bg-surface-2",
            )}
          >
            <Icon className={cn("size-5", active ? "text-brand" : "text-muted")} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemePicker({ current }: { current: Theme }) {
  return (
    <form action={setTheme} className="px-5 pb-5">
      <Options current={current} />
      <p className="mt-2 text-xs text-muted">System follows your phone or computer&apos;s light/dark setting.</p>
    </form>
  );
}
