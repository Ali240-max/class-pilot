import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ActivityStatus, ActivityType } from "@/lib/database.types";
import { formatDateTime, urgencyOf } from "@/lib/time";
import { TYPE_LABEL, buildActivityMessage } from "@/lib/whatsapp";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/card";
import { Countdown } from "@/components/countdown";
import { ShareButton } from "@/components/share-dialog";
import { buttonClass } from "@/components/ui/button";
import { TYPE_ICON, TYPE_STYLE } from "@/components/activity-icons";

export type ActivityListItem = {
  id: string;
  title: string;
  type: ActivityType;
  due_at: string;
  status: ActivityStatus;
  description: string | null;
  course: { id: string; name: string; code: string | null } | null;
};

export function ActivityItem({
  activity: a,
  showCourse = true,
  compact = false,
}: {
  activity: ActivityListItem;
  showCourse?: boolean;
  compact?: boolean;
}) {
  const Icon = TYPE_ICON[a.type];
  const scheduled = a.status === "scheduled";
  const urgency = scheduled ? urgencyOf(a.due_at) : null;

  return (
    <div className={cn("group flex items-start gap-3 px-4 py-3.5 sm:px-5", compact && "py-3")}>
      <span className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl", TYPE_STYLE[a.type])}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn("text-sm font-medium text-ink", !scheduled && "text-muted line-through decoration-muted/50")}>{a.title}</p>
          <span className="text-xs text-muted">{TYPE_LABEL[a.type]}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {showCourse && a.course && (
            <>
              <Link href={`/courses/${a.course.id}`} className="hover:text-ink hover:underline">
                {a.course.code ?? a.course.name}
              </Link>
              {" · "}
            </>
          )}
          {formatDateTime(a.due_at)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {a.status === "completed" ? (
          <Badge tone="success">Completed</Badge>
        ) : a.status === "cancelled" ? (
          <Badge>Cancelled</Badge>
        ) : (
          <Badge tone={urgency === "overdue" ? "danger" : urgency === "today" ? "warning" : urgency === "soon" ? "brand" : "neutral"}>
            <Countdown iso={a.due_at} />
          </Badge>
        )}
        {!compact && (
          <div className="flex gap-1">
            {scheduled && (
              <ShareButton
                message={buildActivityMessage(a)}
                title={a.title}
                label="Share"
                variant="ghost"
              />
            )}
            <Link href={`/planner/${a.id}/edit`} className={buttonClass("ghost", "sm")} aria-label={`Edit ${a.title}`}>
              <Pencil className="size-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
