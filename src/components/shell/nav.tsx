"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  CalendarClock,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/client";

type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/students", label: "Students", icon: Users },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/planner", label: "Planner", icon: CalendarClock },
  { href: "/materials", label: "Materials", icon: FolderOpen },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_PRIMARY = ["/", "/students", "/planner", "/assistant"];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ className, organizerName }: { className?: string; organizerName: string }) {
  const pathname = usePathname();
  return (
    <aside className={cn("flex h-full flex-col border-r border-line bg-surface", className)}>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand shadow-card">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">ClassPilot</p>
          <p className="max-w-36 truncate text-xs text-muted">{organizerName}</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {active && <span className="absolute inset-y-2 left-0 w-0.5 animate-fade-in rounded-full bg-brand" aria-hidden />}
              <Icon className={cn("size-[18px] transition-transform group-hover:scale-110", active ? "text-brand" : "text-muted")} aria-hidden />
              {label}
              {href === "/assistant" && (
                <span className="ml-auto rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-brand uppercase">
                  AI
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <p className="px-5 py-4 text-[11px] text-muted">Times shown in Pakistan Standard Time</p>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const secondary = NAV.filter((n) => !MOBILE_PRIMARY.includes(n.href));
  const moreActive = secondary.some((n) => isActive(pathname, n.href));

  const tab = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
      active ? "text-brand" : "text-muted",
    );

  return (
    <>
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-lg lg:hidden"
      >
        <div className="mx-auto flex max-w-lg">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className={tab(active)}>
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-all", active && "animate-pop bg-brand-soft")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {label === "AI Assistant" ? "Ask AI" : label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className={tab(moreActive)} aria-haspopup="dialog">
            <span className={cn("grid h-7 w-12 place-items-center rounded-full", moreActive && "bg-brand-soft")}>
              <MoreHorizontal className="size-5" aria-hidden />
            </span>
            More
          </button>
        </div>
      </nav>
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="grid grid-cols-2 gap-2">
          {secondary.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-line p-3.5 text-sm font-medium transition-colors hover:bg-surface-2",
                isActive(pathname, href) && "border-brand/40 bg-brand-soft text-brand-ink",
              )}
            >
              <Icon className="size-5 text-brand" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </Dialog>
    </>
  );
}
