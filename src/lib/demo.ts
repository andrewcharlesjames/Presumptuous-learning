import "server-only";
import { db } from "./db";
import { buildQuestions, scoreAssessment, toStored, type Answer } from "./assessment";
import { subjectsForGrade } from "./subjects";
import { addDays, schoolYearOf, todayIn } from "./dates";
import { skillIndex } from "./questions";
import { defaultLaunchDay, MILESTONES, milestoneDates, type ProjectTypeName } from "./projects";
import type { SubjectId } from "./bank";
import { hashPassword, kidPassword, tempPassword } from "./passwords";
import { createSchool, dayInfo, uniqueFamilyCode, uniqueSchoolCode } from "./records";

type Profile = "below" | "at" | "above" | "mixed";

const STUDENTS: { first: string; last: string; grade: number; profile: Profile }[] = [
  { first: "Amira", last: "Khan", grade: 3, profile: "at" },
  { first: "Liam", last: "Tremblay", grade: 3, profile: "below" },
  { first: "Zoe", last: "Chen", grade: 3, profile: "above" },
  { first: "Noah", last: "Osei", grade: 4, profile: "mixed" },
  { first: "Maya", last: "Singh", grade: 4, profile: "at" },
  { first: "Ethan", last: "Brown", grade: 4, profile: "below" },
  { first: "Ava", last: "Martin", grade: 5, profile: "above" },
  { first: "Lucas", last: "Roy", grade: 5, profile: "mixed" },
  { first: "Isla", last: "Campbell", grade: 5, profile: "at" },
  { first: "Omar", last: "Haddad", grade: 5, profile: "below" },
];

/** Deterministic pseudo-random so demo data looks the same each time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function answerFor(profile: Profile, tier: "below" | "at" | "above", n: number, subjectIndex: number): Answer {
  const p = profile === "mixed" ? (["below", "at", "above"] as const)[subjectIndex % 3] : profile;
  let ok: boolean;
  if (p === "above") ok = tier !== "at" || n <= 3;
  else if (p === "at") ok = tier === "below" || (tier === "at" && n <= 2);
  else ok = (tier === "below" && n <= 1) || (tier === "at" && n <= 1);
  return ok ? 0 : n % 2 ? -1 : 2;
}

const GOALS = ["Finish my math practice before lunch", "Ask a question in every lesson", "Master one new skill today", "Write the first draft of my poem", "Get my project proposal approved", "Try the harder questions"];
const LEARNED = ["How to find equivalent fractions with a number line.", "Why authors use a cliffhanger at the end of a chapter.", "That plants need light to make their own food.", "How to read a bar graph with a scale of 5.", "That the Anishinaabe Seven Grandfather Teachings guide how people treat each other.", "How to work out profit: price minus cost."];
const POEMS = [
  { title: "Snow Day Engine", body: "The plow growls past at six a.m.,\na yellow beast with frozen breath.\nI count the flakes, I lose at ten,\nand hope the buses sleep till then." },
  { title: "My Grandmother's Hands", body: "They fold dough like letters,\nsealed with a thumb.\nThey taught me to wait\nfor the bread to rise\nand for the right words to come." },
  { title: "Lake Ontario in November", body: "Grey on grey on grey,\nthe gulls argue anyway.\nThe water keeps its secrets\nand the wind gives them away." },
];
const PROJECTS: Record<ProjectTypeName, { title: string; oneLiner: string; problem: string; audience: string }[]> = {
  LIFE_SKILLS: [
    { title: "Paw Patrol Walks", oneLiner: "After-school dog walking for busy families on my street.", problem: "Parents work late and dogs wait all day.", audience: "Dog owners within four blocks of school" },
    { title: "Bead & Bloom", oneLiner: "Handmade beaded keychains in school colours.", problem: "Students want cheap, custom gear.", audience: "Students and parents at school events" },
    { title: "Fix-It Kids", oneLiner: "Bike tune-ups for kids, by kids.", problem: "Lots of bikes sit broken in garages.", audience: "Families in our neighbourhood" },
    { title: "Lemon Lab", oneLiner: "Lemonade with a new flavour every week, sold at the Saturday market.", problem: "The market has no drinks for kids.", audience: "Families at the farmers' market" },
    { title: "Study Buddy Cards", oneLiner: "Flash-card packs for Grade 3 math facts.", problem: "Younger kids find times tables boring.", audience: "Grade 2 and 3 students and their parents" },
  ],
  PURPOSE: [
    { title: "Warm Hands Drive", oneLiner: "Collect mittens and hats for the community shelter.", problem: "Shelters run out of winter gear by December.", audience: "Families using the community shelter" },
    { title: "Litter Busters", oneLiner: "Monthly park clean-ups with a litter count.", problem: "The park by the creek fills up with plastic.", audience: "Everyone who uses Riverside Park" },
    { title: "Reading Buddies", oneLiner: "Older students read with kindergarten kids each week.", problem: "Some kindergarten kids don't get read to at home.", audience: "Kindergarten classes" },
    { title: "Little Free Pantry", oneLiner: "A food box outside the school, stocked by students.", problem: "Some families need food between paydays.", audience: "Neighbours facing food insecurity" },
    { title: "Pollinator Patch", oneLiner: "Turn a corner of the yard into a bee and butterfly garden.", problem: "Pollinators are losing habitat.", audience: "The school community and local bees" },
  ],
};
const ART_FEEDBACK = ["The last line lands perfectly. Read it aloud at assembly?", "Strong images. Try cutting one word from each line and see what happens.", "I can feel the cold in this. Great sound in 'grey on grey'."];

/** Creates a fully populated demo school for sales demos. Returns sign-in details. */
export async function createDemoSchool() {
  const code = await uniqueSchoolCode("DEMO");
  const adminPassword = tempPassword();
  const school = await createSchool({
    name: "Riverside Demo Academy", code, isDemo: true,
    admin: { firstName: "Priya", lastName: "Patel", email: `principal.${code.toLowerCase()}@demo.presumptuouslearning.test`, password: adminPassword },
  });
  const coachPassword = tempPassword();
  const coachHash = await hashPassword(coachPassword);
  const coachA = await db.user.create({ data: { role: "COACH", schoolId: school.id, email: `coach.${code.toLowerCase()}@demo.presumptuouslearning.test`, firstName: "Marcus", lastName: "Reid", passwordHash: coachHash } });
  const coachB = await db.user.create({ data: { role: "COACH", schoolId: school.id, email: `coach2.${code.toLowerCase()}@demo.presumptuouslearning.test`, firstName: "Sofia", lastName: "Alvarez", passwordHash: coachHash } });
  const classA = await db.class.create({ data: { schoolId: school.id, name: "Junior Studio A", grades: [3, 4], coaches: { create: [{ coachId: coachA.id }] } } });
  const classB = await db.class.create({ data: { schoolId: school.id, name: "Junior Studio B", grades: [5], coaches: { create: [{ coachId: coachB.id }] } } });

  const studentPassword = kidPassword();
  const studentHash = await hashPassword(studentPassword);
  const parentPassword = tempPassword();
  const parentHash = await hashPassword(parentPassword);
  const today = todayIn(school.timezone);
  const r = rng(42);
  let firstStudentUsername = "";
  let firstParentEmail = "";
  const allSids = [...new Set(STUDENTS.flatMap(x => subjectsForGrade(x.grade).map(y => y.id)))] as SubjectId[];
  const skillsAt = await skillIndex(allSids);
  const schoolYear = schoolYearOf(today);
  const launch = school.launchDay ?? defaultLaunchDay(schoolYear);
  const todayInfo = await dayInfo(school, today);

  /** Consent, mastered skills, studio writing, projects and notes for one demo student. */
  async function enrich({ idx, s, student, sids, coach }: { idx: number; s: (typeof STUDENTS)[number]; student: { id: string }; sids: SubjectId[]; coach: { id: string } }) {
    for (const kind of ["PLATFORM", "AI"] as const)
      await db.consent.create({ data: { studentId: student.id, kind, granted: true, givenBy: "school", byName: "Recorded by Priya Patel (paper form)" } });

    // Mastered skills: more for students working above grade; a stuck skill for students below.
    const mastered = s.profile === "above" ? 5 : s.profile === "below" ? 1 : 3;
    let made = 0;
    for (const sid of sids.slice(0, 3)) for (const skill of skillsAt(sid)(s.grade)) {
      if (made >= mastered) break;
      made++;
      await db.skillProgress.create({ data: { studentId: student.id, subject: sid, grade: s.grade, skill, state: "MASTERED", attempts: 1 + (made % 2), lastScore: 4 + (made % 2), lastTotal: 5, masteredAt: addDays(new Date(), -made * 3) } });
    }
    if (s.profile === "below") {
      const skill = skillsAt("math")(s.grade)[1];
      if (skill) await db.skillProgress.create({ data: { studentId: student.id, subject: "math", grade: s.grade, skill, state: "LEARNING", attempts: 3, lastScore: 2, lastTotal: 5 } });
    }

    // Studio: a poem for some students, with coach feedback.
    if (idx % 3 === 0) {
      const poem = POEMS[(idx / 3) % POEMS.length];
      await db.artwork.create({
        data: {
          schoolId: school.id, studentId: student.id, discipline: "WRITING", title: poem.title, textBody: poem.body, featured: idx === 0,
          reflection: "I tried to use rhyme without making it sound forced. Next time I'd add a stronger ending.",
          createdAt: addDays(new Date(), -(idx + 2)),
          feedback: { create: { authorId: coach.id, body: ART_FEEDBACK[(idx / 3) % ART_FEEDBACK.length] } },
        },
      });
    }

    // Projects at different stages: everyone has a Life Skills Project; every other student a Purpose Project too.
    const types: ProjectTypeName[] = idx % 2 === 0 ? ["LIFE_SKILLS", "PURPOSE"] : ["LIFE_SKILLS"];
    for (const type of types) {
      const idea = PROJECTS[type][idx % PROJECTS[type].length];
      const dates = milestoneDates(type, schoolYear, launch, school.yearStart);
      // stage: how many milestones are approved, and whether the next one is waiting for review
      const approved = idx % 4 === 1 ? 1 : 2;
      const submittedNext = idx % 3 !== 2;
      await db.project.create({
        data: {
          schoolId: school.id, studentId: student.id, type, schoolYear, ...idea,
          plan: "1. Talk to five people who'd use it.\n2. Build a first version.\n3. Test it and improve it.\n4. Get ready for Launch Day.",
          milestones: {
            create: MILESTONES[type].map((m, position) => {
              const status = position < approved ? "APPROVED" : position === approved && submittedNext ? "SUBMITTED" : "TODO";
              return {
                position, key: m.key, title: m.title, description: m.description, dueDate: dates[position], status,
                evidence: status === "TODO" ? "" : position === 0 ? `I chose ${idea.title} because ${idea.problem.charAt(0).toLowerCase()}${idea.problem.slice(1)}` : `${idea.oneLiner} I'm aiming at: ${idea.audience}.`,
                submittedAt: status === "TODO" ? null : addDays(dates[position], -2),
                reviewedAt: status === "APPROVED" ? addDays(dates[position], -1) : null,
                reviewedById: status === "APPROVED" ? coach.id : null,
                feedback: status === "APPROVED" ? "Approved. Clear and specific." : "",
              };
            }),
          },
        },
      });
    }

    // Coach notes
    if (s.profile === "below") await db.coachNote.create({ data: { studentId: student.id, authorId: coach.id, shared: true, body: `${s.first} is working hard on math facts. Ten minutes of practice at home this week would help a lot.` } });
    if (s.profile === "above") await db.coachNote.create({ data: { studentId: student.id, authorId: coach.id, shared: true, body: `${s.first} is ready for the next grade's work in math. We've moved the plan up.` } });
    if (idx === 3) await db.coachNote.create({ data: { studentId: student.id, authorId: coach.id, shared: false, body: "Seemed tired this week. Checking in with family." } });
  }

  for (const [idx, s] of STUDENTS.entries()) {
    const username = `${s.first}.${s.last[0]}`.toLowerCase();
    if (!firstStudentUsername) firstStudentUsername = username;
    const student = await db.user.create({
      data: {
        role: "STUDENT", schoolId: school.id, username, firstName: s.first, lastName: s.last, grade: s.grade,
        passwordHash: studentHash, familyCode: await uniqueFamilyCode(), createdAt: addDays(new Date(), -16), // joined just before the demo history starts, so past days count
        studentIn: { create: { classId: s.grade <= 4 ? classA.id : classB.id } },
      },
    });
    if (idx < 4) {
      const email = `parent${idx + 1}.${code.toLowerCase()}@demo.presumptuouslearning.test`;
      if (!firstParentEmail) firstParentEmail = email;
      await db.user.create({ data: { role: "PARENT", schoolId: school.id, email, firstName: ["Sara", "Daniel", "Grace", "Kwame"][idx], lastName: s.last, passwordHash: parentHash, children: { create: { studentId: student.id } } } });
    }
    const sids = subjectsForGrade(s.grade).map(x => x.id);
    const questions = buildQuestions(s.grade, sids, r);
    const seen: Record<string, number> = {};
    const answers = questions.map(q => {
      const k = q.sid + q.tier; seen[k] = (seen[k] ?? 0) + 1;
      return answerFor(s.profile, q.tier!, seen[k], sids.indexOf(q.sid));
    });
    const results = toStored(scoreAssessment(s.grade, sids, questions, answers));
    const completedAt = addDays(new Date(), -((idx % 5) + 2));
    await db.assessment.create({ data: { studentId: student.id, grade: s.grade, subjects: sids, questions, answers, results, status: "COMPLETE", startedAt: completedAt, completedAt } });

    // attendance for recent school days
    for (let back = 1, made = 0; made < 10 && back < 30; back++) {
      const d = addDays(today, -back);
      const info = await dayInfo(school, d);
      if (!info.schoolDay) continue;
      made++;
      const roll = r();
      const status = roll < 0.88 ? "PRESENT" : roll < 0.94 ? "LATE" : "ABSENT";
      await db.attendance.create({ data: { schoolId: school.id, studentId: student.id, date: d, status, markedById: s.grade <= 4 ? coachA.id : coachB.id } });
      if (status === "ABSENT") continue;
      // A full school day: check in, a practice set, and (most days) a reflection. Recent days are complete so streaks show.
      const reflected = back <= 6 + (idx % 3) || r() < 0.7;
      await db.dailyLog.create({
        data: {
          studentId: student.id, date: d, mood: 3 + Math.floor(r() * 3), goal: GOALS[(idx + back) % GOALS.length],
          checkedInAt: new Date(d.getTime() + 13.5 * 3600_000),
          learned: reflected ? LEARNED[(idx + back) % LEARNED.length] : "", effort: reflected ? 2 + Math.floor(r() * 3) : null,
          reflectedAt: reflected ? new Date(d.getTime() + 20 * 3600_000) : null, artsDone: r() < 0.8, lifeDone: r() < 0.6,
        },
      });
      const sid = sids[(idx + back) % sids.length];
      const skill = skillsAt(sid)(s.grade)[back % Math.max(1, skillsAt(sid)(s.grade).length)] ?? "";
      const total = 5, correct = s.profile === "below" ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3);
      await db.practiceSession.create({ data: { studentId: student.id, subject: sid, grade: s.grade, skill, questions: [], answers: [], correct, total, startedAt: new Date(d.getTime() + 15 * 3600_000), completedAt: new Date(d.getTime() + 15.2 * 3600_000) } });
    }
    await enrich({ idx, s, student, sids, coach: s.grade <= 4 ? coachA : coachB });
  }
  // Coach assignments: a skill for students below level, and practice for everyone in Studio B.
  const below = await db.user.findMany({ where: { schoolId: school.id, role: "STUDENT", lastName: { in: ["Tremblay", "Brown"] } } });
  const mathSkill = skillsAt("math")(3)[0] ?? "";
  if (mathSkill && below.length) await db.assignment.create({ data: { schoolId: school.id, createdById: coachA.id, kind: "MASTER_SKILL", subject: "math", grade: 3, skill: mathSkill, note: "Let's lock this in before the unit test.", dueDate: addDays(today, 4), targets: { create: below.map(b => ({ studentId: b.id })) } } });
  const classBStudents = await db.classStudent.findMany({ where: { classId: classB.id } });
  const langSkill = skillsAt("lang")(5)[0] ?? "";
  if (langSkill) await db.assignment.create({ data: { schoolId: school.id, createdById: coachB.id, kind: "PRACTICE", subject: "lang", grade: 5, skill: langSkill, note: "One set before Friday.", dueDate: addDays(today, 3), targets: { create: classBStudents.map(c => ({ studentId: c.studentId })) } } });

  // Today: a few students have already checked in.
  if (todayInfo.schoolDay) {
    const firstFew = await db.user.findMany({ where: { schoolId: school.id, role: "STUDENT" }, orderBy: { createdAt: "asc" }, take: 6 });
    for (const [i, st] of firstFew.entries()) {
      await db.dailyLog.upsert({
        where: { studentId_date: { studentId: st.id, date: today } }, update: {},
        create: { studentId: st.id, date: today, mood: i === 1 ? 2 : 4, goal: GOALS[i % GOALS.length], checkedInAt: new Date() },
      });
    }
  }

  return {
    school,
    logins: [
      { label: "School code", value: code },
      { label: "Principal (school admin)", value: `principal.${code.toLowerCase()}@demo.presumptuouslearning.test / ${adminPassword}` },
      { label: "Coach", value: `coach.${code.toLowerCase()}@demo.presumptuouslearning.test / ${coachPassword}` },
      { label: "Parent", value: `${firstParentEmail} / ${parentPassword}` },
      { label: "Student (any demo student)", value: `${firstStudentUsername} / ${studentPassword}` },
    ],
  };
}
