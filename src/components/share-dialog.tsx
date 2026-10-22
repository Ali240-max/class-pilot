"use client";

import { useId, useState, type ReactNode } from "react";
import { Check, Copy, MessageCircle, Send, Share2, UserRound, Users } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/client";
import { Field, Input, Textarea } from "@/components/ui/field";
import { normalizePhone } from "@/lib/phone";
import { whatsappUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";

const DEFAULT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_TEST_NUMBER ?? "";

/**
 * User-confirmed WhatsApp sharing. Nothing is sent automatically: each option
 * opens WhatsApp (or the device share sheet) with the text filled in, and the
 * CR chooses the chat or group and taps Send there.
 */
export function ShareButton({
  message,
  title,
  label = "Share",
  variant = "secondary",
  size = "sm",
  icon,
}: {
  message: string;
  title: string;
  label?: string;
  variant?: "secondary" | "whatsapp" | "ghost" | "primary";
  size?: "sm" | "md";
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {icon ?? <MessageCircle className="size-4" aria-hidden />}
        {label}
      </Button>
      {open && <ShareDialog message={message} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareDialog({ message, title, onClose }: { message: string; title: string; onClose: () => void }) {
  const id = useId();
  const [text, setText] = useState(message);
  const [mode, setMode] = useState<"chooser" | "number">("chooser");
  const [phone, setPhone] = useState(DEFAULT_NUMBER);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const normalized = normalizePhone(phone);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNote("Couldn't copy automatically. Select the text above and copy it manually.");
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setNote("Sharing isn't available here. Use Copy instead.");
    }
  }

  const waHref = whatsappUrl(text, mode === "number" ? normalized : null);
  const waDisabled = !text.trim() || (mode === "number" && !normalized);

  return (
    <Dialog open onClose={onClose} title="Share on WhatsApp">
      <div className="space-y-4">
        <Field label="Message" htmlFor={`${id}-msg`} hint="Edit anything before sharing. *text* shows as bold in WhatsApp.">
          <Textarea id={`${id}-msg`} value={text} onChange={(e) => setText(e.target.value)} rows={9} className="font-mono text-[13px] leading-relaxed" />
        </Field>

        <div role="radiogroup" aria-label="Send to" className="grid grid-cols-2 gap-2">
          {[
            { value: "chooser" as const, icon: Users, label: "Group or chat", sub: "Pick in WhatsApp" },
            { value: "number" as const, icon: UserRound, label: "Phone number", sub: "Open a direct chat" },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={mode === o.value}
              onClick={() => setMode(o.value)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all",
                mode === o.value ? "border-brand bg-brand-soft ring-2 ring-brand/15" : "border-line hover:bg-surface-2",
              )}
            >
              <o.icon className={cn("size-5 shrink-0", mode === o.value ? "text-brand" : "text-muted")} aria-hidden />
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted">{o.sub}</span>
              </span>
            </button>
          ))}
        </div>

        {mode === "number" && (
          <Field
            label="WhatsApp number"
            htmlFor={`${id}-phone`}
            error={phone && !normalized ? "Enter a valid number, e.g. 0300-1234567" : undefined}
          >
            <Input id={`${id}-phone`} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" />
          </Field>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={waDisabled ? undefined : waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={waDisabled}
            className={cn(buttonClass("whatsapp", "md", "flex-1"), waDisabled && "pointer-events-none opacity-50")}
          >
            <Send className="size-4" aria-hidden />
            Open in WhatsApp
          </a>
          <Button variant="secondary" onClick={copy} className="flex-1">
            {copied ? <Check className="size-4 animate-pop text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? "Copied" : "Copy message"}
          </Button>
          {canNativeShare && (
            <Button variant="secondary" onClick={nativeShare} aria-label="More sharing options">
              <Share2 className="size-4" aria-hidden />
              <span className="sm:hidden">More options</span>
            </Button>
          )}
        </div>

        <p className="text-xs text-muted" role={note ? "alert" : undefined}>
          {note ??
            (mode === "chooser"
              ? "WhatsApp will ask which chat or group to send to. The message is only sent when you tap Send there."
              : "Opens a chat with this number. The message is only sent when you tap Send in WhatsApp.")}
        </p>
      </div>
    </Dialog>
  );
}
