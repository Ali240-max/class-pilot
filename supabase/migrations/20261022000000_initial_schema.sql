-- ClassPilot initial schema
-- Every row belongs to one organizer (the CR/GR). Row Level Security limits each
-- signed-in organizer to their own rows. Composite foreign keys (id, organizer_id)
-- make it impossible to link a row to another organizer's course/student/etc.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizer profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.organizers (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  class_name text not null default '' check (char_length(class_name) <= 120),
  institution text not null default '' check (char_length(institution) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizers_updated_at before update on public.organizers
  for each row execute function public.set_updated_at();

-- Create a profile automatically when an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organizers (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.organizers (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  student_code text check (student_code is null or char_length(btrim(student_code)) between 1 and 40),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organizer_id)
);

-- Student IDs must be unique per organizer (case-insensitive).
create unique index students_unique_code on public.students (organizer_id, lower(student_code))
  where student_code is not null;
create index students_organizer_name on public.students (organizer_id, full_name);

create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.organizers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text check (code is null or char_length(btrim(code)) between 1 and 30),
  instructor_name text check (instructor_name is null or char_length(instructor_name) <= 120),
  description text check (description is null or char_length(description) <= 2000),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organizer_id)
);

create unique index courses_unique_code on public.courses (organizer_id, lower(code))
  where code is not null;
create index courses_organizer_status on public.courses (organizer_id, status);

create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Academic activities (assignments, quizzes, exams)
-- "Upcoming" / "overdue" are derived from due_at + status, not stored.
-- ---------------------------------------------------------------------------
create table public.academic_activities (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.organizers (id) on delete cascade,
  course_id uuid not null,
  type text not null check (type in ('assignment', 'quiz', 'exam')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 4000),
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organizer_id),
  foreign key (course_id, organizer_id) references public.courses (id, organizer_id) on delete restrict
);

create index activities_organizer_due on public.academic_activities (organizer_id, due_at);
create index activities_course on public.academic_activities (course_id);

create trigger activities_updated_at before update on public.academic_activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Attendance
-- Percentage definition (see student_attendance_summary):
--   attended = present + late
--   counted  = present + late + absent   (excused sessions are excluded)
-- ---------------------------------------------------------------------------
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.organizers (id) on delete cascade,
  session_date date not null,
  course_id uuid,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organizer_id),
  foreign key (course_id, organizer_id) references public.courses (id, organizer_id)
    on delete set null (course_id)
);

create index attendance_sessions_organizer_date on public.attendance_sessions (organizer_id, session_date desc);

create trigger attendance_sessions_updated_at before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.organizers (id) on delete cascade,
  session_id uuid not null,
  student_id uuid not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id),
  foreign key (session_id, organizer_id) references public.attendance_sessions (id, organizer_id) on delete cascade,
  foreign key (student_id, organizer_id) references public.students (id, organizer_id) on delete cascade
);

create index attendance_records_student on public.attendance_records (student_id);

create trigger attendance_records_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Educational materials (files live in the private "materials" storage bucket)
-- ---------------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.organizers (id) on delete cascade,
  course_id uuid not null,
  activity_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_id, organizer_id) references public.courses (id, organizer_id) on delete restrict,
  foreign key (activity_id, organizer_id) references public.academic_activities (id, organizer_id)
    on delete set null (activity_id)
);

create index materials_organizer_created on public.materials (organizer_id, created_at desc);
create index materials_course on public.materials (course_id);

create trigger materials_updated_at before update on public.materials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Announcements (saved WhatsApp messages / class updates)
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null default auth.uid() references public.organizers (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  course_id uuid,
  activity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_id, organizer_id) references public.courses (id, organizer_id)
    on delete set null (course_id),
  foreign key (activity_id, organizer_id) references public.academic_activities (id, organizer_id)
    on delete set null (activity_id)
);

create index announcements_organizer_created on public.announcements (organizer_id, created_at desc);

create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Attendance summary per student (runs with the caller's permissions)
-- ---------------------------------------------------------------------------
create view public.student_attendance_summary
with (security_invoker = true) as
select
  s.id as student_id,
  s.organizer_id,
  count(r.id) filter (where r.status = 'present')::int as present_count,
  count(r.id) filter (where r.status = 'late')::int as late_count,
  count(r.id) filter (where r.status = 'absent')::int as absent_count,
  count(r.id) filter (where r.status = 'excused')::int as excused_count,
  count(r.id) filter (where r.status in ('present', 'late', 'absent'))::int as counted_sessions,
  case
    when count(r.id) filter (where r.status in ('present', 'late', 'absent')) = 0 then null
    else round(
      100.0 * count(r.id) filter (where r.status in ('present', 'late'))
        / count(r.id) filter (where r.status in ('present', 'late', 'absent')),
      1
    )
  end as attendance_percent
from public.students s
left join public.attendance_records r on r.student_id = s.id
group by s.id, s.organizer_id;

-- ---------------------------------------------------------------------------
-- Row Level Security: organizers only see and change their own rows
-- ---------------------------------------------------------------------------
alter table public.organizers enable row level security;
alter table public.students enable row level security;
alter table public.courses enable row level security;
alter table public.academic_activities enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.materials enable row level security;
alter table public.announcements enable row level security;

create policy "organizer reads own profile" on public.organizers
  for select to authenticated using (id = (select auth.uid()));
create policy "organizer updates own profile" on public.organizers
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'students', 'courses', 'academic_activities', 'attendance_sessions',
    'attendance_records', 'materials', 'announcements'
  ]
  loop
    execute format(
      'create policy "owner select" on public.%I for select to authenticated using (organizer_id = (select auth.uid()))', t);
    execute format(
      'create policy "owner insert" on public.%I for insert to authenticated with check (organizer_id = (select auth.uid()))', t);
    execute format(
      'create policy "owner update" on public.%I for update to authenticated using (organizer_id = (select auth.uid())) with check (organizer_id = (select auth.uid()))', t);
    execute format(
      'create policy "owner delete" on public.%I for delete to authenticated using (organizer_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Anonymous visitors get nothing.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.student_attendance_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage bucket for materials. Objects are stored under
-- "<organizer_id>/<uuid>-<file name>" and only that organizer can touch them.
-- Files are served through short-lived signed URLs only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials', 'materials', false, 26214400,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do nothing;

create policy "organizer reads own materials" on storage.objects
  for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "organizer uploads own materials" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "organizer deletes own materials" on storage.objects
  for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = (select auth.uid())::text);
