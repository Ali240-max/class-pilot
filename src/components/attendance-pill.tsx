import { Badge } from "@/components/ui/card";

export const ATTENDANCE_THRESHOLD = 75;

/** Attendance percentage badge. Null means no counted sessions yet. */
export function AttendancePill({ percent }: { percent: number | null | undefined }) {
  if (percent === null || percent === undefined) return <Badge>No record</Badge>;
  const tone = percent >= ATTENDANCE_THRESHOLD ? "success" : percent >= 60 ? "warning" : "danger";
  return <Badge tone={tone} className="tabular-nums">{percent}%</Badge>;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, className = "size-10 text-sm" }: { name: string; className?: string }) {
  // Stable pastel colour per name.
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${className}`}
      // Pastel in light mode, deep and muted in dark mode.
      style={{
        background: `light-dark(hsl(${hue} 70% 92%), hsl(${hue} 35% 22%))`,
        color: `light-dark(hsl(${hue} 45% 32%), hsl(${hue} 60% 82%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}
