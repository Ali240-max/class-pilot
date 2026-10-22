import { ClipboardList, GraduationCap, HelpCircle, type LucideIcon } from "lucide-react";
import type { ActivityType } from "@/lib/database.types";

export const TYPE_ICON: Record<ActivityType, LucideIcon> = {
  assignment: ClipboardList,
  quiz: HelpCircle,
  exam: GraduationCap,
};

export const TYPE_STYLE: Record<ActivityType, string> = {
  assignment: "bg-info-soft text-info",
  quiz: "bg-warning-soft text-warning",
  exam: "bg-danger-soft text-danger",
};
