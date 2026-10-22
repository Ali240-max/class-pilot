import type { Metadata } from "next";
import { CheckCircle2, LogOut, XCircle } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { aiConfig, isAiConfigured } from "@/lib/ai/groq";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/client";
import { signOut } from "@/app/login/actions";
import { getShowDatabaseFacts, getTheme } from "@/lib/preferences";
import { ProfileForm } from "./profile-form";
import { FactsSwitch } from "./facts-switch";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, email } = await requireOrganizer();
  const { data: profile } = await supabase.from("organizers").select("full_name, class_name, institution").maybeSingle();
  const ai = isAiConfigured();
  const [showFacts, theme] = await Promise.all([getShowDatabaseFacts(), getTheme()]);

  const checks = [
    { label: "Database", ok: true, detail: "Connected to Supabase" },
    { label: "AI assistant", ok: ai, detail: ai ? `Groq model: ${aiConfig().model}` : "Set GROQ_API_KEY in .env.local" },
    {
      label: "WhatsApp test number",
      ok: Boolean(process.env.NEXT_PUBLIC_WHATSAPP_TEST_NUMBER),
      detail: process.env.NEXT_PUBLIC_WHATSAPP_TEST_NUMBER ? "Prefilled in the share dialog" : "Optional: NEXT_PUBLIC_WHATSAPP_TEST_NUMBER",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Settings" description={`Signed in as ${email}`} />
      <ProfileForm profile={profile ?? { full_name: "", class_name: "", institution: "" }} />

      <Card className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <CardHeader title="Appearance" />
        <ThemePicker current={theme} />
      </Card>

      <Card className="animate-fade-up" style={{ animationDelay: "60ms" }}>
        <CardHeader title="AI assistant" />
        <FactsSwitch enabled={showFacts} />
      </Card>

      <Card className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <CardHeader title="Status" />
        <ul className="divide-y divide-line">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 px-5 py-3">
              {c.ok ? <CheckCircle2 className="size-4 text-success" aria-label="OK" /> : <XCircle className="size-4 text-muted" aria-label="Not set" />}
              <span className="text-sm font-medium">{c.label}</span>
              <span className="ml-auto text-right text-xs text-muted">{c.detail}</span>
            </li>
          ))}
        </ul>
      </Card>

      <form action={signOut} className="animate-fade-up" style={{ animationDelay: "120ms" }}>
        <SubmitButton variant="secondary" className="w-full" pendingText="Signing out…">
          <LogOut className="size-4" aria-hidden />
          Sign out
        </SubmitButton>
      </form>
    </div>
  );
}
