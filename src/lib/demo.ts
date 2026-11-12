import "server-only";
import { db } from "./db";
import { buildQuestions, scoreAssessment, toStored, type Answer } from "./assessment";
import { subjectsForGrade } from "./subjects";
import { addDays, todayIn } from "./dates";
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

  for (const [idx, s] of STUDENTS.entries()) {
    const username = `${s.first}.${s.last[0]}`.toLowerCase();
    if (!firstStudentUsername) firstStudentUsername = username;
    const student = await db.user.create({
      data: {
        role: "STUDENT", schoolId: school.id, username, firstName: s.first, lastName: s.last, grade: s.grade,
        passwordHash: studentHash, familyCode: await uniqueFamilyCode(),
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
      return answerFor(s.profile, q.tier, seen[k], sids.indexOf(q.sid));
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
