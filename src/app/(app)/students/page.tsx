import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Phone, Plus, UserRoundX, Users } from "lucide-react";
import { requireOrganizer } from "@/lib/auth";
import { must } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { stagger } from "@/lib/cn";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { FilterTabs } from "@/components/filter-tabs";
import { ATTENDANCE_THRESHOLD, AttendancePill, Avatar } from "@/components/attendance-pill";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const status = sp.status === "inactive" || sp.status === "all" || sp.status === "low" ? sp.status : "active";

  const { supabase } = await requireOrganizer();
  const [students, summaries] = await Promise.all([
    supabase.from("students").select("id, full_name, student_code, phone, status").order("full_name"),
    supabase.from("student_attendance_summary").select("student_id, attendance_percent, counted_sessions"),
  ]);
  const all = must(students, "students");
  const pct = new Map(must(summaries, "attendance").map((s) => [s.student_id, s.attendance_percent]));

  // Filtering happens here (class sizes are small), so search covers name, ID and phone safely.
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  const matchesSearch = (s: (typeof all)[number]) =>
    !needle ||
    s.full_name.toLowerCase().includes(needle) ||
    (s.student_code?.toLowerCase().includes(needle) ?? false) ||
    (digits.length >= 3 && (s.phone?.includes(digits.replace(/^0/, "")) ?? false));
  const low = (s: (typeof all)[number]) => {
    const p = pct.get(s.id);
    return s.status === "active" && p !== null && p !== undefined && p < ATTENDANCE_THRESHOLD;
  };

  const counts = {
    active: all.filter((s) => s.status === "active").length,
    low: all.filter(low).length,
    inactive: all.filter((s) => s.status === "inactive").length,
    all: all.length,
  };
  const list = all
    .filter((s) => (status === "all" ? true : status === "low" ? low(s) : s.status === status))
    .filter(matchesSearch);

  return (
    <>
      <PageHeader
        title="Students"
        description={`${counts.active} active · ${counts.all} total`}
        actions={
          <LinkButton href="/students/new">
            <Plus className="size-4" aria-hidden />
            Add student
          </LinkButton>
        }
      />

      <div className="mb-4 flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "60ms" }}>
        <div className="sm:w-80">
          <SearchInput label="Search students" placeholder="Search name, ID or phone" />
        </div>
        <FilterTabs
          label="Filter students"
          param="status"
          current={status}
          basePath="/students"
          searchParams={sp}
          options={[
            { value: "active", label: "Active", count: counts.active },
            { value: "low", label: `Below ${ATTENDANCE_THRESHOLD}%`, count: counts.low },
            { value: "inactive", label: "Inactive", count: counts.inactive },
            { value: "all", label: "All", count: counts.all },
          ]}
        />
      </div>

      <Card>
        {all.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students yet"
            description="Add your classmates to track attendance and share updates."
            action={
              <LinkButton href="/students/new">
                <Plus className="size-4" aria-hidden /> Add first student
              </LinkButton>
            }
          />
        ) : list.length === 0 ? (
          <EmptyState icon={UserRoundX} title="No matches" description={q ? `Nobody matches “${q}”.` : "No students in this filter."} />
        ) : (
          <ul className="stagger divide-y divide-line">
            {list.map((s, i) => (
              <li key={s.id} style={stagger(Math.min(i, 12))}>
                <Link
                  href={`/students/${s.id}`}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-2 sm:px-5"
                >
                  <Avatar name={s.full_name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                      {s.full_name}
                      {s.status === "inactive" && <Badge>Inactive</Badge>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                      {s.student_code && <span className="font-mono">{s.student_code}</span>}
                      {s.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3" aria-hidden />
                          {formatPhone(s.phone)}
                        </span>
                      )}
                    </p>
                  </div>
                  <AttendancePill percent={pct.get(s.id)} />
                  <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 px-1 text-xs text-muted">
        Attendance % = (present + late) ÷ (present + late + absent). Excused sessions aren&apos;t counted.
      </p>
    </>
  );
}
