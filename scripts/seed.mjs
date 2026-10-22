// Seeds the demo organizer account with realistic, clearly-labelled demo data.
//
//   npm run seed            create the demo account + data (skips if data exists)
//   npm run seed -- --reset wipe ONLY the demo account's data and re-create it
//
// Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// DEMO_EMAIL, DEMO_PASSWORD. Optional: NEXT_PUBLIC_WHATSAPP_TEST_NUMBER.
// The service-role key is used only here, never by the web app.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
const reset = process.argv.includes("--reset");

if (!url || !serviceKey || !email || !password) {
  console.error("Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL and DEMO_PASSWORD in .env.local");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PKT_MS = 5 * 3600 * 1000;
const DAY = 86400 * 1000;

/** ISO time for (today in PKT + days) at hh:mm PKT. */
function pktAt(days, hh, mm = 0) {
  const pktNow = new Date(Date.now() + PKT_MS);
  const base = Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), pktNow.getUTCDate() + days, hh, mm) - PKT_MS;
  return new Date(base).toISOString();
}

/** "YYYY-MM-DD" for (today in PKT + days). */
function pktDate(days) {
  return new Date(Date.now() + PKT_MS + days * DAY).toISOString().slice(0, 10);
}

/** Deterministic pseudo-random numbers so the demo looks the same every run. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function normalizePk(phone) {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (/^03\d{9}$/.test(d)) return `+92${d.slice(1)}`;
  if (/^923\d{9}$/.test(d)) return `+${d}`;
  return null;
}

/** Minimal one-page PDF containing a few lines of text. */
function makePdf(title, lines) {
  const esc = (t) => t.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const body = [
    "BT /F1 20 Tf 60 760 Td (" + esc(title) + ") Tj ET",
    ...lines.map((l, i) => `BT /F1 12 Tf 60 ${720 - i * 20} Td (${esc(l)}) Tj ET`),
    "BT /F1 9 Tf 60 60 Td (ClassPilot demo material - sample content for testing.) Tj ET",
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function check(res, what) {
  if (res.error) {
    console.error(`✗ ${what}: ${res.error.message}`);
    process.exit(1);
  }
  return res.data;
}

// ---------------------------------------------------------------------------
// 1. Demo organizer account
// ---------------------------------------------------------------------------
async function findUser() {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUser();
if (!user) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Zainab Hussain" },
  });
  if (error) {
    console.error("✗ Couldn't create demo user:", error.message);
    process.exit(1);
  }
  user = data.user;
  console.log(`✓ Created demo account ${email}`);
} else {
  // Keep the password in sync with .env.local.
  await db.auth.admin.updateUserById(user.id, { password });
  console.log(`✓ Demo account ${email} exists`);
}
const uid = user.id;

check(
  await db.from("organizers").upsert({
    id: uid,
    full_name: "Zainab Hussain",
    class_name: "BS Computer Science — 5th Semester (Section A)",
    institution: "Demo University, Karachi",
  }),
  "organizer profile",
);

// ---------------------------------------------------------------------------
// 2. Reset (demo account only)
// ---------------------------------------------------------------------------
const existing = check(await db.from("courses").select("id", { count: "exact", head: false }).eq("organizer_id", uid), "check existing");
if (existing.length > 0 && !reset) {
  console.log("ℹ Demo data already exists. Run `npm run seed -- --reset` to replace it.");
  process.exit(0);
}
if (existing.length > 0) {
  const files = check(await db.storage.from("materials").list(uid, { limit: 1000 }), "list files");
  if (files.length) await db.storage.from("materials").remove(files.map((f) => `${uid}/${f.name}`));
  for (const table of ["announcements", "materials", "attendance_records", "attendance_sessions", "academic_activities", "students", "courses"]) {
    check(await db.from(table).delete().eq("organizer_id", uid), `clear ${table}`);
  }
  console.log("✓ Cleared previous demo data");
}

// ---------------------------------------------------------------------------
// 3. Courses
// ---------------------------------------------------------------------------
const courseRows = [
  { key: "dsa", name: "Data Structures & Algorithms", code: "CS-201", instructor_name: "Dr. Syed Ali Naqvi", description: "Arrays, linked lists, stacks, queues, trees, graphs and algorithm analysis. Labs every Thursday." },
  { key: "db", name: "Database Systems", code: "CS-301", instructor_name: "Ms. Fatima Rizvi", description: "Relational model, SQL, normalization, transactions and indexing." },
  { key: "os", name: "Operating Systems", code: "CS-302", instructor_name: "Dr. Hasan Abbas Zaidi", description: "Processes, threads, scheduling, memory management and file systems." },
  { key: "la", name: "Linear Algebra", code: "MTH-205", instructor_name: "Prof. Kazim Jafri", description: "Matrices, vector spaces, eigenvalues and applications." },
  { key: "tw", name: "Technical Writing", code: "ENG-210", instructor_name: "Ms. Sughra Bukhari", description: "Reports, proposals, documentation and presentations." },
  { key: "isl", name: "Islamic Studies", code: "ISL-101", instructor_name: "Maulana Muhammad Taqi", description: "Seerah, ethics and history." },
  { key: "pf", name: "Programming Fundamentals", code: "CS-101", instructor_name: "Mr. Askari Shah", description: "Completed last semester.", status: "archived" },
];
const courses = check(
  await db
    .from("courses")
    .insert(
      courseRows.map((c) => ({
        name: c.name,
        code: c.code,
        instructor_name: c.instructor_name,
        description: c.description,
        status: c.status ?? "active",
        organizer_id: uid,
      })),
    )
    .select("id, code"),
  "courses",
);
const C = Object.fromEntries(courseRows.map((c) => [c.key, courses.find((x) => x.code === c.code).id]));
console.log(`✓ ${courses.length} courses`);

// ---------------------------------------------------------------------------
// 4. Students (only the test recipient has a phone number)
// ---------------------------------------------------------------------------
const testPhone = normalizePk(process.env.NEXT_PUBLIC_WHATSAPP_TEST_NUMBER ?? "");
const names = [
  "Ali Raza Naqvi", "Fatima Zahra Rizvi", "Hussain Abbas", "Sakina Kazmi", "Abbas Haider Jafri", "Masooma Zaidi",
  "Muhammad Taqi", "Ruqaiya Bukhari", "Hasan Mehdi", "Kulsoom Hyder", "Jafar Hussain Shah", "Narjis Abidi",
  "Askari Naqvi", "Batool Fatima", "Mujtaba Rizvi", "Kaneez Sughra", "Sajjad Haider", "Umme Laila Jafri",
  "Qasim Abbas", "Hiba Zaidi", "Kumail Shah", "Zahra Batool", "Raza Mehdi",
];
// Attendance likelihood per student: most are regular, a few fall below 75%.
const propensity = [0.95, 0.92, 0.6, 0.97, 0.88, 0.7, 0.93, 0.9, 0.55, 0.96, 0.85, 0.91, 0.66, 0.94, 0.89, 0.93, 0.72, 0.98, 0.9, 0.87, 0.95, 0.91, 0.5];
const studentRows = names.map((full_name, i) => ({
  organizer_id: uid,
  full_name,
  student_code: `BSCS-23-${String(i + 1).padStart(3, "0")}`,
  phone: null,
  status: i === names.length - 1 ? "inactive" : "active",
  notes: i === names.length - 1 ? "Transferred to evening section in week 6." : i === 2 ? "Often late because of transport — university point route 7." : null,
}));
studentRows.push({
  organizer_id: uid,
  full_name: "WhatsApp Test Recipient (demo)",
  student_code: "TEST-001",
  phone: testPhone,
  status: "active",
  notes: "Demo contact for testing WhatsApp sharing. Not a real classmate.",
});
propensity.push(0.9);
const students = check(await db.from("students").insert(studentRows).select("id, student_code"), "students");
const studentIds = studentRows.map((s) => students.find((x) => x.student_code === s.student_code).id);
console.log(`✓ ${students.length} students${testPhone ? ` (test recipient ${testPhone})` : ""}`);

// ---------------------------------------------------------------------------
// 5. Planner: assignments, quizzes, exams around "now"
// ---------------------------------------------------------------------------
const soon = new Date(Date.now() + 4 * 3600 * 1000);
soon.setUTCMinutes(0, 0, 0);
const activities = [
  // Past
  { course_id: C.dsa, type: "assignment", title: "Assignment 1: Complexity Analysis", due_at: pktAt(-18, 23, 59), status: "completed", description: "Big-O analysis of 10 code snippets. Submit PDF on LMS." },
  { course_id: C.la, type: "quiz", title: "Quiz 1: Matrix Operations", due_at: pktAt(-12, 10), status: "completed", description: "Chapter 1 & 2." },
  { course_id: C.db, type: "assignment", title: "ER Diagram for Library System", due_at: pktAt(-9, 23, 59), status: "completed", description: "Draw with draw.io and upload PNG + explanation." },
  { course_id: C.tw, type: "assignment", title: "Formal Email Writing Task", due_at: pktAt(-3, 17), status: "scheduled", description: "Write 3 formal emails as per handout. Hard copy in class." },
  { course_id: C.os, type: "assignment", title: "Lab 4: Process Scheduling Simulator", due_at: pktAt(-1, 23, 59), status: "scheduled", description: "Implement FCFS and Round Robin in C. Zip source + report." },
  // Today / tomorrow
  { course_id: C.dsa, type: "quiz", title: "Quiz 2: Linked Lists", due_at: soon.toISOString(), status: "scheduled", description: "Singly & doubly linked lists, insertion/deletion. 20 minutes, closed book. Room B-14." },
  { course_id: C.db, type: "quiz", title: "Quiz 2: SQL Joins", due_at: pktAt(1, 11, 30), status: "scheduled", description: "INNER/LEFT/RIGHT joins, GROUP BY, HAVING. No calculators needed." },
  { course_id: C.la, type: "assignment", title: "Problem Set 3: Vector Spaces", due_at: pktAt(1, 23, 59), status: "scheduled", description: "Exercises 3.1–3.4, odd numbers only." },
  // This week
  { course_id: C.os, type: "quiz", title: "Quiz 3: Deadlocks", due_at: pktAt(3, 9, 30), status: "scheduled", description: "Banker's algorithm and resource allocation graphs." },
  { course_id: C.tw, type: "assignment", title: "Project Proposal Draft", due_at: pktAt(4, 17), status: "scheduled", description: "2–3 pages. Use the IEEE template shared in Materials." },
  { course_id: C.dsa, type: "assignment", title: "Assignment 3: Binary Search Trees", due_at: pktAt(5, 23, 59), status: "scheduled", description: "Implement insert, delete and traversals in C++. Viva in next lab." },
  { course_id: C.isl, type: "assignment", title: "Essay: Ethics in Professional Life", due_at: pktAt(6, 12), status: "scheduled", description: "800–1000 words, handwritten." },
  // Later
  { course_id: C.db, type: "exam", title: "Midterm Exam", due_at: pktAt(10, 9), status: "scheduled", description: "Chapters 1–6. Exam hall A, seat plan will be shared." },
  { course_id: C.dsa, type: "exam", title: "Midterm Exam", due_at: pktAt(12, 9), status: "scheduled", description: "Everything up to trees. 90 minutes." },
  { course_id: C.os, type: "exam", title: "Midterm Exam", due_at: pktAt(13, 13), status: "scheduled", description: "Processes to memory management." },
  { course_id: C.la, type: "quiz", title: "Quiz 3: Eigenvalues", due_at: pktAt(16, 10), status: "scheduled", description: null },
  { course_id: C.tw, type: "assignment", title: "Group Presentation", due_at: pktAt(20, 10), status: "cancelled", description: "Postponed by instructor — new date TBA." },
];
const acts = check(
  await db.from("academic_activities").insert(activities.map((a) => ({ ...a, organizer_id: uid }))).select("id, title, course_id"),
  "activities",
);
console.log(`✓ ${acts.length} planner items`);

// ---------------------------------------------------------------------------
// 6. Attendance: weekday sessions over the last ~4 weeks + today
// ---------------------------------------------------------------------------
const rand = rng(20261022);
const schedule = [C.dsa, C.db, C.os, C.la, C.tw, C.isl];
const sessionRows = [];
for (let d = -27; d <= 0; d++) {
  const dt = new Date(Date.now() + PKT_MS + d * DAY);
  const dow = dt.getUTCDay();
  if (dow === 0 || dow === 6) continue; // weekends off
  sessionRows.push({ organizer_id: uid, session_date: pktDate(d), course_id: schedule[(dow + d + 30) % schedule.length], notes: null });
}
const sessions = check(await db.from("attendance_sessions").insert(sessionRows).select("id, session_date"), "attendance sessions");

const records = [];
for (const s of sessions) {
  studentIds.forEach((sid, i) => {
    if (studentRows[i].status === "inactive" && s.session_date > pktDate(-10)) return; // left the section
    const r = rand();
    const p = propensity[i];
    const status = r < p - 0.06 ? "present" : r < p ? "late" : r < p + 0.04 ? "excused" : "absent";
    records.push({ organizer_id: uid, session_id: s.id, student_id: sid, status });
  });
}
for (let i = 0; i < records.length; i += 500) check(await db.from("attendance_records").insert(records.slice(i, i + 500)), "attendance records");
console.log(`✓ ${sessions.length} attendance sessions, ${records.length} records`);

// ---------------------------------------------------------------------------
// 7. Materials (small generated PDFs in the private bucket)
// ---------------------------------------------------------------------------
const materialSpecs = [
  { course: C.dsa, title: "Lecture 7 — Linked Lists (slides)", file: "lecture-07-linked-lists.pdf", description: "Covers everything for Quiz 2.", lines: ["Singly linked lists", "Doubly linked lists", "Insertion and deletion", "Practice problems"], activity: "Quiz 2: Linked Lists" },
  { course: C.db, title: "SQL Joins Cheat Sheet", file: "sql-joins-cheatsheet.pdf", description: "One-page summary shared by Ms. Rizvi.", lines: ["INNER JOIN", "LEFT / RIGHT JOIN", "GROUP BY and HAVING"], activity: "Quiz 2: SQL Joins" },
  { course: C.tw, title: "IEEE Proposal Template", file: "ieee-proposal-template.pdf", description: "Use this for the project proposal draft.", lines: ["Title", "Abstract", "Problem statement", "Methodology", "Timeline"], activity: "Project Proposal Draft" },
  { course: C.os, title: "Deadlocks — Chapter 7 Notes", file: "os-ch7-deadlocks.pdf", description: null, lines: ["Necessary conditions", "Banker's algorithm", "Resource allocation graphs"], activity: null },
  { course: C.la, title: "Midterm Syllabus & Past Paper", file: "mth205-midterm-syllabus.pdf", description: "Chapters 1-4 plus a past paper for practice.", lines: ["Chapter 1: Systems of equations", "Chapter 2: Matrices", "Chapter 3: Vector spaces", "Chapter 4: Linear maps"], activity: null },
];
let matCount = 0;
for (const [i, m] of materialSpecs.entries()) {
  const bytes = makePdf(m.title, m.lines);
  const path = `${uid}/${crypto.randomUUID()}-${m.file}`;
  const up = await db.storage.from("materials").upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (up.error) {
    console.warn(`! Skipped material upload (${m.file}): ${up.error.message}`);
    continue;
  }
  const activityId = m.activity ? acts.find((a) => a.title === m.activity && a.course_id === m.course)?.id ?? null : null;
  check(
    await db.from("materials").insert({
      organizer_id: uid,
      course_id: m.course,
      activity_id: activityId,
      title: m.title,
      description: m.description,
      storage_path: path,
      file_name: m.file,
      mime_type: "application/pdf",
      size_bytes: bytes.length,
      created_at: new Date(Date.now() - (materialSpecs.length - i) * 26 * 3600 * 1000).toISOString(),
    }),
    "material",
  );
  matCount++;
}
console.log(`✓ ${matCount} materials`);

// ---------------------------------------------------------------------------
// 8. Announcements
// ---------------------------------------------------------------------------
check(
  await db.from("announcements").insert([
    { organizer_id: uid, title: "Midterm date sheet released", body: "Midterms start in 10 days. Date sheet is on the notice board.", created_at: new Date(Date.now() - 2 * DAY).toISOString() },
    { organizer_id: uid, title: "OS lab moved to Lab 3", body: "From this week OS labs are in Lab 3, ground floor.", course_id: C.os, created_at: new Date(Date.now() - 4 * DAY).toISOString() },
    { organizer_id: uid, title: "Class photo on Friday", body: "Wear uniform. 12:30 PM at the main lawn.", created_at: new Date(Date.now() - 6 * DAY).toISOString() },
  ]),
  "announcements",
);
console.log("✓ 3 announcements");
console.log(`\nDone. Sign in with ${email} (or tap “Continue with demo account”).`);
