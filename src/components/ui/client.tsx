"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button, buttonClass } from "./button";
import { cn } from "@/lib/cn";

/** Submit button that shows a spinner while its form's Server Action runs. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}

/** Modal built on the native <dialog> element (focus trap + Esc handled by the browser). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-scale-in max-sm:mb-3 max-sm:open:animate-slide-up",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="dialog-title" className="text-base font-semibold">
          {title}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="-mr-2 size-8">
          <X className="size-4" />
        </Button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

/** A form button that asks for confirmation before submitting (e.g. delete). */
export function ConfirmSubmit({
  action,
  hiddenFields,
  label,
  confirmTitle,
  confirmText,
  confirmLabel = "Delete",
  icon,
  variant = "secondary",
  size = "md",
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  label: string;
  confirmTitle: string;
  confirmText: string;
  confirmLabel?: string;
  icon?: ReactNode;
  variant?: "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} className={variant !== "danger" ? "text-danger" : undefined}>
        {icon}
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={confirmTitle}>
        <p className="text-sm text-ink-2">{confirmText}</p>
        <form action={action} className="mt-6 flex justify-end gap-2">
          {Object.entries(hiddenFields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton variant="danger" pendingText="Working…">
            {confirmLabel}
          </SubmitButton>
        </form>
      </Dialog>
    </>
  );
}

const TOASTS: Record<string, string> = {
  "student-created": "Student added",
  "student-updated": "Student updated",
  "student-deleted": "Student deleted",
  "course-created": "Course created",
  "course-updated": "Course updated",
  "course-archived": "Course archived",
  "course-restored": "Course restored",
  "activity-created": "Activity added to planner",
  "activity-updated": "Activity updated",
  "activity-deleted": "Activity deleted",
  "activity-completed": "Marked as completed",
  "profile-updated": "Settings saved",
  "preference-saved": "Preference saved",
  "session-updated": "Session details updated",
  "session-exists": "A session already exists for that date — opened it",
  "session-deleted": "Session deleted",
};

/** Shows a success toast when the URL has ?toast=<key>, then removes the param. */
export function Toast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.get("toast");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    const text = TOASTS[key];
    const next = new URLSearchParams(params);
    next.delete("toast");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (!text) return;
    // Show the toast after the URL settles, then hide it.
    const show = setTimeout(() => setMessage(text), 0);
    const hide = setTimeout(() => setMessage(null), 3200);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [key, params, pathname, router]);

  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-4 z-50 mx-auto flex w-fit animate-slide-up items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-pop"
    >
      <CheckCircle2 className="size-4 animate-pop text-success" aria-hidden />
      {message}
    </div>
  );
}
