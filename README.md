# Presumptuous Learning

**Overreaching is how students get ahead.**

A platform for schools that assesses every subject in a student's Ontario curriculum (Kindergarten to Grade 12), places each subject below, at or above grade level, and builds a plan for the day, the month and the school year. Students, parents, coaches and school admins each get their own view.

## Phase 2

- Question bank in the database with a platform-admin editor, coverage map and teacher-review flag.
- 471 written questions plus 31 math generators (fresh numbers and worked explanations every time).
- Adaptive placement: starts at the student's grade, moves up or down until it finds the level they work at.
- Daily practice: 5-question sets from the plan, with instant feedback; visible to coaches and parents.
- AI tutor (optional, per school): short explanations of wrong practice answers, written by Claude. Only the question, choices, chosen answer and grade are sent.

## Phase 1

- **Schools as separate spaces.** Each school's people, classes, timetable, calendar and records stay inside that school.
- **Roles:** platform admin (creates schools), school admin, coach (title can be renamed per school), parent, student.
- **Sign-in:** adults use email and password. Students use school code + username + an easy password (e.g. `otter-482-pine`).
- **Parents** create their own account at `/join` with a child's family code and can link more children.
- **School admin:** people (add one, or import a CSV class list), classes (combined grades welcome), the school day timetable, the school calendar (Ontario template included), settings, school-wide placement overview.
- **Coach:** class roster with each student's placement by subject (levels 1–4), next-level requirements, attendance by day, password resets.
- **Student:** Today screen that follows the school timetable with the personal plan inside Core Academics; the placement assessment (saves as you go); the full plan for today, the month and the year.
- **Demo school:** the platform admin can create a fully populated demo school for sales demos in one click.

## Running locally

Requires Node 22 and Postgres.

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL and the ADMIN_* values
npx prisma migrate dev
npm run dev
```

Sign in at http://localhost:3000/login with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (the platform admin is created the first time the app starts with `npm start`; in dev run `node scripts/bootstrap.mjs` once).

### Tests

```bash
npm test          # unit tests: question bank, scoring, plans, Ontario calendar
npm run typecheck
# end-to-end walk-through of every role (needs a running server and Playwright installed):
BASE=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/e2e.mjs
```

## Deploying on Railway

1. In Railway, **New Project → Deploy from GitHub repo** → choose this repository.
2. In the same project, **+ Create → Database → PostgreSQL**.
3. Open the app service → **Variables**, and add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (Railway's reference to the database)
   - `ADMIN_EMAIL` = your email
   - `ADMIN_PASSWORD` = a long password (12+ characters) for the first platform admin
   - `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` (optional)
   - `ANTHROPIC_API_KEY` (optional): turns on the AI tutor. Each school still has to switch it on in Settings.
4. App service → **Settings → Networking → Generate Domain** to get a public URL.
5. Railway builds with `npm run build` and starts with `npm start`, which applies database migrations, creates the platform admin if none exists, and starts the app. The health check is `/api/health`.

Every push to `main` redeploys automatically. After your first sign-in you can remove `ADMIN_PASSWORD` from Railway; it's only used to create the first admin.

## Project layout

```
prisma/schema.prisma      data model (schools, users, classes, timetable, calendar, attendance, assessments)
src/lib/bank.ts           question bank (Phase 2 moves it into the database with an editor)
src/lib/assessment.ts     question selection and Ontario level scoring
src/lib/plan.ts           daily / monthly / yearly plan engine
src/lib/templates.ts      default school day and Ontario calendar template
src/app/                  pages by role: admin/, school/, coach/, parent/, student/, students/[id]
```

## Privacy notes

- Passwords are hashed with scrypt; sessions are random tokens stored hashed.
- Every student record check is scoped to the viewer's school and relationship (own child, own class).
- One-time passwords are shown once and never placed in URLs.
- Student data is hosted wherever the database runs. Ontario public boards usually require Canadian hosting (planned for Phase 7).
