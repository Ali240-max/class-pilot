import type { Metadata } from "next";
import { CalendarClock, GraduationCap, MessageCircle, Sparkles } from "lucide-react";
import { stagger } from "@/lib/cn";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const rawNext = typeof params.next === "string" ? params.next : "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const demoEnabled = Boolean(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD);

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#2b2343] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -top-32 -right-32 size-[28rem] rounded-full bg-[#6a58a7]/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 size-[24rem] rounded-full bg-[#4ab1b5]/20 blur-3xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-white/10">
            <GraduationCap className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold">ClassPilot</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">Run your class without the chaos.</h2>
          <p className="mt-4 text-[#c4bcdc]">
            Students, deadlines, attendance and WhatsApp announcements, organised in one place for CRs and GRs.
          </p>
          <ul className="stagger mt-10 space-y-4 text-sm text-[#e1deed]">
            {[
              { icon: CalendarClock, text: "Every quiz and deadline with a live countdown" },
              { icon: MessageCircle, text: "Ready-to-send WhatsApp reminders" },
              { icon: Sparkles, text: "An AI assistant that answers from your real class data" },
            ].map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-center gap-3" style={stagger(i + 2)}>
                <span className="grid size-8 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[#a69bca]">All times in Pakistan Standard Time.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 lg:hidden">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand text-on-brand shadow-card">
              <GraduationCap className="size-6" aria-hidden />
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 mb-8 text-sm text-muted">Sign in to manage your class.</p>
          <LoginForm next={next} demoEnabled={demoEnabled} />
        </div>
      </section>
    </main>
  );
}
