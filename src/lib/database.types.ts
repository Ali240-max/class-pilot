// Hand-written to match supabase/migrations. If the schema changes, update this
// file (or regenerate with `npx supabase gen types typescript`).

type Timestamps = { created_at: string; updated_at: string };

export type StudentStatus = "active" | "inactive";
export type CourseStatus = "active" | "archived";
export type ActivityType = "assignment" | "quiz" | "exam";
export type ActivityStatus = "scheduled" | "completed" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type OrganizerRow = Timestamps & {
  id: string;
  full_name: string;
  class_name: string;
  institution: string;
};

export type StudentRow = Timestamps & {
  id: string;
  organizer_id: string;
  full_name: string;
  student_code: string | null;
  phone: string | null;
  status: StudentStatus;
  notes: string | null;
};

export type CourseRow = Timestamps & {
  id: string;
  organizer_id: string;
  name: string;
  code: string | null;
  instructor_name: string | null;
  description: string | null;
  status: CourseStatus;
};

export type ActivityRow = Timestamps & {
  id: string;
  organizer_id: string;
  course_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  due_at: string;
  status: ActivityStatus;
};

export type AttendanceSessionRow = Timestamps & {
  id: string;
  organizer_id: string;
  session_date: string;
  course_id: string | null;
  notes: string | null;
};

export type AttendanceRecordRow = Timestamps & {
  id: string;
  organizer_id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
};

export type MaterialRow = Timestamps & {
  id: string;
  organizer_id: string;
  course_id: string;
  activity_id: string | null;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export type AnnouncementRow = Timestamps & {
  id: string;
  organizer_id: string;
  title: string;
  body: string;
  course_id: string | null;
  activity_id: string | null;
};

export type AttendanceSummaryRow = {
  student_id: string;
  organizer_id: string;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  counted_sessions: number;
  attendance_percent: number | null;
};

// Columns with database defaults are optional on insert.
type Insert<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>;
type AutoCols = "id" | "organizer_id" | "created_at" | "updated_at";

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Ins, Rels extends Rel[] = []> = {
  Row: Row;
  Insert: Ins;
  Update: Partial<Row>;
  Relationships: Rels;
};

export type Database = {
  public: {
    Tables: {
      organizers: Table<OrganizerRow, Insert<OrganizerRow, "full_name" | "class_name" | "institution" | "created_at" | "updated_at">>;
      students: Table<
        StudentRow,
        Insert<StudentRow, AutoCols | "student_code" | "phone" | "status" | "notes">
      >;
      courses: Table<
        CourseRow,
        Insert<CourseRow, AutoCols | "code" | "instructor_name" | "description" | "status">
      >;
      academic_activities: Table<
        ActivityRow,
        Insert<ActivityRow, AutoCols | "description" | "status">,
        [
          {
            foreignKeyName: "academic_activities_course_id_organizer_id_fkey";
            columns: ["course_id", "organizer_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "organizer_id"];
          },
        ]
      >;
      attendance_sessions: Table<
        AttendanceSessionRow,
        Insert<AttendanceSessionRow, AutoCols | "course_id" | "notes">,
        [
          {
            foreignKeyName: "attendance_sessions_course_id_organizer_id_fkey";
            columns: ["course_id", "organizer_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "organizer_id"];
          },
        ]
      >;
      attendance_records: Table<
        AttendanceRecordRow,
        Insert<AttendanceRecordRow, AutoCols>,
        [
          {
            foreignKeyName: "attendance_records_session_id_organizer_id_fkey";
            columns: ["session_id", "organizer_id"];
            isOneToOne: false;
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id", "organizer_id"];
          },
          {
            foreignKeyName: "attendance_records_student_id_organizer_id_fkey";
            columns: ["student_id", "organizer_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id", "organizer_id"];
          },
        ]
      >;
      materials: Table<
        MaterialRow,
        Insert<MaterialRow, AutoCols | "activity_id" | "description">,
        [
          {
            foreignKeyName: "materials_course_id_organizer_id_fkey";
            columns: ["course_id", "organizer_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "organizer_id"];
          },
          {
            foreignKeyName: "materials_activity_id_organizer_id_fkey";
            columns: ["activity_id", "organizer_id"];
            isOneToOne: false;
            referencedRelation: "academic_activities";
            referencedColumns: ["id", "organizer_id"];
          },
        ]
      >;
      announcements: Table<
        AnnouncementRow,
        Insert<AnnouncementRow, AutoCols | "course_id" | "activity_id">,
        [
          {
            foreignKeyName: "announcements_course_id_organizer_id_fkey";
            columns: ["course_id", "organizer_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "organizer_id"];
          },
        ]
      >;
    };
    Views: {
      student_attendance_summary: {
        Row: AttendanceSummaryRow;
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
