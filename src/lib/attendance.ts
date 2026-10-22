import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceStatus, Database } from "@/lib/database.types";

export type RecordRow = { session_id: string; student_id: string; status: AttendanceStatus };

/**
 * All attendance records for the given sessions. Supabase returns at most
 * 1000 rows per request and long id lists make URLs too big, so this reads
 * in batches of sessions and pages of rows.
 */
export async function fetchRecordsForSessions(supabase: SupabaseClient<Database>, sessionIds: string[]): Promise<RecordRow[]> {
  const out: RecordRow[] = [];
  for (let i = 0; i < sessionIds.length; i += 100) {
    const batch = sessionIds.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("session_id, student_id, status")
        .in("session_id", batch)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`Couldn't load attendance records: ${error.message}`);
      out.push(...data);
      if (data.length < 1000) break;
    }
  }
  return out;
}

export type Tally = { present: number; late: number; absent: number; excused: number };

export const emptyTally = (): Tally => ({ present: 0, late: 0, absent: 0, excused: 0 });

/** percent = (present + late) / (present + late + absent); excused isn't counted. */
export function attendancePercent(t: Tally): number | null {
  const counted = t.present + t.late + t.absent;
  return counted ? Math.round((1000 * (t.present + t.late)) / counted) / 10 : null;
}
