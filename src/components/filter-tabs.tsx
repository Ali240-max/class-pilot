import Link from "next/link";
import { cn } from "@/lib/cn";

/** Segmented links that set one search param, keeping the others. */
export function FilterTabs({
  param,
  options,
  current,
  basePath,
  searchParams,
  label,
}: {
  param: string;
  options: { value: string; label: string; count?: number }[];
  current: string;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  label: string;
}) {
  const hrefFor = (value: string) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string" && k !== param && k !== "toast") next.set(k, v);
    }
    if (value !== options[0].value) next.set(param, value);
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card [scrollbar-width:none]">
      {options.map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value}
            href={hrefFor(o.value)}
            replace
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
              active ? "bg-brand text-on-brand shadow-card" : "text-ink-2 hover:bg-surface-2",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-on-brand/20" : "bg-surface-2 text-muted")}>
                {o.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
