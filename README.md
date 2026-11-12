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

## Phase 9: email, sign-in options and report cards

- **Email** through [Resend](https://resend.com): password reset links, a Friday parent email (each child's week, with one-click unsubscribe), pilot request alerts and invoices. Without `RESEND_API_KEY` and `EMAIL_FROM` nothing is sent and each email is logged as not sent. Platform admin → **Email** shows every email, sends a test and can run the weekly email on demand.
- **Forgot your password** for adults: a link that works once for 60 minutes and signs out other devices.
- **Sign in with Google or Microsoft** for staff and parents. Google connects automatically by verified email; Microsoft is connected once from **Account** after a normal sign-in.
- **QR sign-in cards** for students (class page → Sign-in cards): print, scan, replace a lost card.
- **Report cards**: fall progress report, Term 1 and Term 2, in Ontario's format (progress words, letters for Grades 1–6, percentages for 7–12, comments only for Kindergarten), six learning skills (E/G/S/N) suggested from the student's term, comment drafts from their mastery data. Coaches release them to families; a released report never changes.

### Phase 9 setup in Railway (all optional)

| Variable | What it does |
| --- | --- |
| `APP_URL` | Your app's public address, e.g. `https://app.presumptuouslearning.ca`, used in email links and sign-in. Railway's own domain is used if unset. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Turn on email. `EMAIL_FROM` like `Presumptuous Learning <hello@presumptuouslearning.ca>` on a domain verified in Resend. |
| `EMAIL_REPLY_TO`, `SALES_EMAIL` | Where replies go; where pilot alerts go (default `ADMIN_EMAIL`). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Sign in with Google. Redirect URI: `APP_URL/api/auth/google/callback`. |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` | Sign in with Microsoft. Redirect URI: `APP_URL/api/auth/microsoft/callback`. Tenant defaults to `common`. |
| `WEEKLY_EMAIL=off` | Stops the Friday parent email. |

## Phase 8: sales and growth

- **Marketing site** at `/`: how it works, a view for each role, the school day, projects and Launch Day, privacy, pricing, and a **Request a pilot** form (spam honeypot and rate limit).
- **Pilot requests** (Platform admin → Pilot requests): mark contacted or closed, or **Start a pilot**, which creates the school with a 90-day pilot licence and its admin account.
- **Licences** (Platform admin → click a school): plan (Pilot or Active), seats, start and end dates, price per student per year, billing email. Adding or importing students past the seat limit is refused. School admins see a banner 30 days before the licence ends, after it ends, or when they're over their seats; coaches see one only once it has ended. Nothing is locked when a licence ends.
- **Invoices**: created by the platform admin with 13% HST, numbered PL-year-0001; mark paid, unpaid or void. School admins see them under **Billing** and can print or save each as a PDF. Set `BILLING_NAME` and `HST_NUMBER` in Railway to show them on invoices.
- **Richer demo school**: two months of history, daily check-ins and reflections with streaks, practice, mastered skills, a stuck student for "Needs attention", poems with coach feedback, Life Skills and Purpose Projects at different stages, assignments, notes and consents.

## Phase 7: privacy and school readiness

- **Audit log** (School admin → Privacy): every view of a student's records by staff or parents, plus exports, deletions, password resets, consent and settings changes.
- **Consent:** parents give or withdraw consent for platform use and for AI features (at sign-up and from their dashboard); admins can record paper consent. Schools choose whether AI features need consent (on by default). Without it, a student's AI tutor and project ideas stay off.
- **Data rights:** parents and school admins can download everything about a student as JSON; parents can request deletion; school admins permanently delete a student and all their data.
- **Privacy notice** at `/privacy` (a draft for legal review).
- **Accessibility:** the end-to-end test runs axe-core (WCAG 2.1 A/AA) on 15 main screens.

### Backups (do this in Railway)

Open the **Postgres** service → **Backups** (or **Volumes → Backups**, depending on your plan) and turn on scheduled backups (daily, keep at least 7). Test a restore once on a copy before relying on it.

## Privacy notes

- Passwords are hashed with scrypt; sessions are random tokens stored hashed.
- Every student record check is scoped to the viewer's school and relationship (own child, own class).
- One-time passwords are shown once and never placed in URLs.
- Student data is hosted wherever the database runs. Ontario public boards usually require Canadian hosting (planned for Phase 7).
