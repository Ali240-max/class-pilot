# ClassPilot

A mobile-first, installable web app for a class representative (CR/GR): students, courses, a deadline planner with WhatsApp sharing, attendance records, materials, and an AI assistant (Groq) that answers from real class data.

Built with Next.js 16 (App Router), Tailwind CSS 4, Supabase (Postgres, Auth, Storage) and the Groq API.

## Setup (about 10 minutes)

1. **Install:** `npm install`
2. **Create a Supabase project** at [supabase.com](https://supabase.com). Singapore or Mumbai is the closest region.
3. **Run the migration:** Supabase → SQL Editor → paste all of `supabase/migrations/20261022000000_initial_schema.sql` → Run.
   (Or with the CLI: `npx supabase link` then `npx supabase db push`.)
4. **Fill in `.env.local`** (see `.env.example`):

   | Variable | Where to find it | Exposed to browser? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | yes (safe) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page → publishable / anon key | yes (safe, RLS protects data) |
   | `SUPABASE_SERVICE_ROLE_KEY` | same page → secret / service_role key | **no**, used only by `npm run seed` |
   | `DEMO_EMAIL`, `DEMO_PASSWORD` | your choice | no |
   | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys (starts with `gsk_`) | **no**, server only |
   | `GROQ_MODEL` | optional, default `openai/gpt-oss-120b` | no |
   | `NEXT_PUBLIC_WHATSAPP_TEST_NUMBER` | optional, prefilled in the share dialog | yes |

5. **Load demo data:** `npm run seed`. This creates the demo login and fills it with courses, 24 students, planner items, about 4 weeks of attendance, 5 PDF materials and announcements. Re-create it any time with `npm run seed -- --reset`, which only touches the demo account.
6. **Run:** `npm run dev` → http://localhost:3000 → **Continue with demo account**.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route type generation + TypeScript |
| `npm run seed` | Create the demo account and demo data |

## Security model

- Every table has **Row Level Security**: an organizer can only read or write rows where `organizer_id = auth.uid()`.
- **Composite foreign keys** `(id, organizer_id)` stop a row from pointing at another organizer's course or student, even through the API.
- Every page, Server Action and API route re-checks the session on the server (`src/lib/auth.ts`). The proxy redirect is only a convenience.
- All form input is validated on the server with Zod (`src/lib/validation.ts`).
- Materials live in a **private** storage bucket. Downloads use signed URLs that expire after 5 minutes.
- The service-role key is used only by the seed script, never by the web app.

## AI assistant

`POST /api/assistant` → checks the session → runs fixed, read-only queries for the question (`src/lib/ai/context.ts`) → calculates counts, deadlines and attendance in code → sends a compact JSON summary to Groq.

- The UI shows **"From your class database"** facts separately from the **AI answer**.
- Student phone numbers and notes are never sent to the model. The AI has no SQL access.
- With no API key, a rate limit or a provider error, the database facts still show along with a clear message.

## Times

Everything is entered and displayed in **Pakistan Standard Time (UTC+05:00)** and stored as UTC `timestamptz`. See `src/lib/time.ts`.

## WhatsApp

Sharing is always user-confirmed. The share dialog opens WhatsApp with an editable message, either for a group/chat you choose in WhatsApp or for a specific number. It also offers Copy and, on phones, the native share sheet. Nothing is ever sent automatically.

## Status

| Area | Status |
|---|---|
| App shell, navigation, PWA (manifest, icons, offline page) | ✅ |
| Supabase schema, RLS, storage bucket, demo seed | ✅ |
| Demo login / email sign-in / sign-out | ✅ |
| Dashboard | ✅ |
| Students CRUD, search, filters, attendance % and history | ✅ |
| Courses create / edit / archive / detail | ✅ |
| Planner: assignments, quizzes, exams, countdowns, filters, WhatsApp share, weekly summary | ✅ |
| AI assistant (Groq) | ✅ |
| Attendance: sessions, fast marking (bulk + per student), corrections, delete | ✅ |
| Materials | 🟡 list, download and share; upload UI is next |
| Saving announcements from the share dialog | ⏳ |
