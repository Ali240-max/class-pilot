import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, Database, GraduationCap } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAiConfigured } from "@/lib/ai/groq";
import { Card } from "@/components/ui/card";
import { stagger } from "@/lib/cn";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  const steps = [
    { done: false, title: "Create a Supabase project", body: "supabase.com → New project. Any region works; Singapore or Mumbai is closest to Pakistan." },
    {
      done: false,
      title: "Add keys to .env.local",
      body: "Project Settings → API. Copy the Project URL, the publishable (anon) key and the secret (service role) key into .env.local.",
    },
    { done: false, title: "Run the database migration", body: "SQL Editor → paste supabase/migrations/20261022000000_initial_schema.sql → Run." },
    { done: false, title: "Load demo data", body: "In the project folder run: npm run seed" },
    { done: isAiConfigured(), title: "Add your Groq API key", body: "Get a key at console.groq.com and set GROQ_API_KEY in .env.local for the AI assistant (optional for the rest of the app)." },
  ];

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <div className="mb-8 flex animate-fade-up items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-brand text-on-brand">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finish setting up ClassPilot</h1>
          <p className="text-sm text-muted">The database isn&apos;t connected yet.</p>
        </div>
      </div>
      <Card className="stagger divide-y divide-line">
        {steps.map((s, i) => (
          <div key={s.title} className="flex gap-3 p-4" style={stagger(i)}>
            {s.done ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Done" />
            ) : (
              <Circle className="mt-0.5 size-5 shrink-0 text-muted" aria-label="To do" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {i + 1}. {s.title}
              </p>
              <p className="mt-0.5 text-sm text-muted">{s.body}</p>
            </div>
          </div>
        ))}
      </Card>
      <p className="mt-6 flex items-center gap-2 text-sm text-muted">
        <Database className="size-4" aria-hidden />
        Restart <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">npm run dev</code> after editing .env.local.
      </p>
    </main>
  );
}
