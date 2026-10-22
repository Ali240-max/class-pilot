"use client";

import { useEffect, useState } from "react";
import { timeRemaining } from "@/lib/time";

/** Live "in 2d 4h" / "3h overdue" label that refreshes every 30 seconds. */
export function Countdown({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {timeRemaining(iso, now)}
    </time>
  );
}
