import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClock, CalendarRange, CheckCheck, Plus, SearchX } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { deadlineChecks } from "@/lib/activities";
import type { ActivityType } from "@/lib/database.types";
import { formatLongDate, pktDayStart } from "@/lib/time";
import { TYPE_LABEL, TYPE_LABEL_PLURAL, buildDigestMessage } from "@/lib/whatsapp";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/client";
import { FilterTabs } from "@/components/filter-tabs";
import { ParamSelect } from "@/components/param-select";
import { ShareButton } from "@/components/share-dialog";
import { ActivityItem, type ActivityListItem } from "@/components/activity-item";
import { completeActivity } from "./actions";

export const metadata: Metadata = { title: "Planner" };

type View = "upcoming" | "overdue" | "completed" | "all";

function groupUpcoming(items: ActivityListItem[]) {
  const bounds = [
    { label: "Today", end: pktDayStart(1) },
    { label: "Tomorrow", end: pktDayStart(2) },
    { label: "Next 7 days", end: pktDayStart(7) },
    { label: "Later", end: new Date(8.64e15) },
  ];
  const groups = bounds.map((b) => ({ label: b.label, items: [] as ActivityListItem[] }));
  for (const a of items) {
    const due = new Date(a.due_at);
    const idx = bounds.findIndex((b) => due < b.end);
    groups[idx === -1 ? groups.length - 1 : idx].items.push(a);
  }
  return groups.filter((g) => g.items.length > 0);
}

export default async function PlannerPage({ searchParams }: PageProps<"/planner">) {
  const sp = await searchParams;
  const view: View = sp.view === "overdue" || sp.view === "completed" || sp.view === "all" ? sp.view : "upcoming";
  const type = typeof sp.type === "string" && sp.type in TYPE_LABEL ? (sp.type as ActivityType) : null;
  const courseId = typeof sp.course === "string" ? sp.course : null;

  const { supabase } = await requireOrganizer();
  const [actsRes, coursesRes] = await Promise.all([
    supabase.from("academic_activities").select("id, title, type, due_at, status, description, course:courses(id, name, code)").order("due_at"),
    supabase.from("courses").select("id, name, code, status").order("name"),
  ]);
  const all: ActivityListItem[] = must(actsRes, "activities");
  const courses = must(coursesRes, "courses");

  const { isUpcoming, isOverdue, dueBefore } = deadlineChecks();

  const filtered = all.filter((a) => (!type || a.type === type) && (!courseId || a.course?.id === courseId));
  const counts = {
    upcoming: filtered.filter(isUpcoming).length,
    overdue: filtered.filter(isOverdue).length,
    completed: filtered.filter((a) => a.status === "completed").length,
    all: filtered.length,
  };
  const shown =
    view === "upcoming"
      ? filtered.filter(isUpcoming)
      : view === "overdue"
        ? filtered.filter(isOverdue).reverse()
        : view === "completed"
          ? filtered.filter((a) => a.status === "completed").reverse()
          : filtered;

  const thisWeek = all.filter((a) => isUpcoming(a) && dueBefore(a, pktDayStart(7)));
  const weeklyDigest = buildDigestMessage(`📅 This week's deadlines (${formatLongDate(new Date())} onwards)`, thisWeek);

  return (
    <>
      <PageHeader
        title="Planner"
        description="Assignments, quizzes and exams. All times in PKT."
        actions={
          <>
            <ShareButton
              message={weeklyDigest}
              title="This week's deadlines"
              label="Weekly summary"
              size="md"
              icon={<CalendarRange className="size-4" aria-hidden />}
            />
            <LinkButton href="/planner/new">
              <Plus className="size-4" aria-hidden />
              Add
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 flex animate-fade-up flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Planner view"
          param="view"
          current={view}
          basePath="/planner"
          searchParams={sp}
          options={[
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "overdue", label: "Overdue", count: counts.overdue },
            { value: "completed", label: "Completed", count: counts.completed },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
        <Suspense>
          <div className="grid grid-cols-2 gap-2 lg:w-96">
            <ParamSelect
              param="course"
              label="Filter by course"
              options={[{ value: "", label: "All courses" }, ...courses.map((c) => ({ value: c.id, label: c.code ?? c.name }))]}
            />
            <ParamSelect
              param="type"
              label="Filter by type"
              options={[{ value: "", label: "All types" }, ...Object.entries(TYPE_LABEL_PLURAL).map(([value, label]) => ({ value, label }))]}
            />
          </div>
        </Suspense>
      </div>

      {all.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            title="Your planner is empty"
            description={courses.length ? "Add an assignment, quiz or exam to start tracking deadlines." : "Create a course first, then add its assignments and quizzes."}
            action={
              <LinkButton href={courses.length ? "/planner/new" : "/courses/new"}>
                <Plus className="size-4" aria-hidden />
                {courses.length ? "Add activity" : "Create a course"}
              </LinkButton>
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={view === "overdue" ? CheckCheck : SearchX}
            title={view === "overdue" ? "Nothing overdue" : "Nothing here"}
            description={view === "overdue" ? "Every past deadline is marked completed or cancelled." : "Try a different filter."}
          />
        </Card>
      ) : view === "upcoming" ? (
        <div className="space-y-4">
          {groupUpcoming(shown).map((g, gi) => (
            <section key={g.label} className="animate-fade-up" style={{ animationDelay: `${gi * 60}ms` }}>
              <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {g.label} · {g.items.length}
              </h2>
              <Card className="divide-y divide-line">
                {g.items.map((a) => (
                  <ActivityItem key={a.id} activity={a} />
                ))}
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card className="animate-fade-up divide-y divide-line">
          {shown.map((a) => (
            <div key={a.id}>
              <ActivityItem activity={a} />
              {isOverdue(a) && (
                <form action={completeActivity} className="-mt-2 flex justify-end px-4 pb-3 sm:px-5">
                  <input type="hidden" name="id" value={a.id} />
                  <SubmitButton variant="secondary" size="sm" pendingText="Saving…">
                    <CheckCheck className="size-3.5" aria-hidden />
                    Mark completed
                  </SubmitButton>
                </form>
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
