// Presumptuous Project (a business) and Purpose Project (community impact): templates and schedule.
import { addDays, utcDate, weekdayIndex } from "./dates.ts";

export type ProjectTypeName = "LIFE_SKILLS" | "PURPOSE";
/** Shown under the project name so families know what it is. */
export const PROJECT_SUB: Record<ProjectTypeName, string> = { LIFE_SKILLS: "Life Skills · Business", PURPOSE: "Community impact" };
export const PROJECT_LABEL: Record<ProjectTypeName, string> = { LIFE_SKILLS: "Presumptuous Project", PURPOSE: "Purpose Project" };
export const PROJECT_BLURB: Record<ProjectTypeName, string> = {
  LIFE_SKILLS: "Start a real business you care about, from first idea to Launch Day.",
  PURPOSE: "Make a real difference in your school or community, and show the impact.",
};

export const INTERVIEW: { key: string; q: string; hint: string }[] = [
  { key: "love", q: "What do you love doing when nobody tells you to?", hint: "Hobbies, games, sports, making things, anything." },
  { key: "good", q: "What are you good at, or what do people ask you for help with?", hint: "Even small things count." },
  { key: "bugs", q: "What problem in your school, neighbourhood or the world bugs you?", hint: "Something you wish someone would fix." },
  { key: "help", q: "Who would you most like to help?", hint: "Younger kids, seniors, animals, newcomers, the environment, your friends…" },
  { key: "make", q: "If you could make, sell or run one thing, what would it be?", hint: "A product, a service, an event, an app, a club…" },
  { key: "work", q: "How do you like to work?", hint: "Alone or with a team, indoors or outdoors, with tech, art, people or your hands." },
];

/** month: 0 = January. Milestones run September to June, with Launch Day in May. */
type Template = { key: string; title: string; description: string; month: number; day: number };
export const MILESTONES: Record<ProjectTypeName, Template[]> = {
  LIFE_SKILLS: [
    { key: "discovery", title: "Discover your idea", description: "Answer the discovery questions and choose a business idea that fits you.", month: 8, day: 30 },
    { key: "proposal", title: "Proposal", description: "Write your business in one line: the problem, your customer, and what you'll sell. Your coach approves it.", month: 9, day: 31 },
    { key: "research", title: "Customer research", description: "Talk to at least 5 possible customers. What do they need? What would they pay?", month: 10, day: 30 },
    { key: "plan", title: "Business plan and budget", description: "List your costs, set a price, and work out your profit per sale. Plan how a parent will handle any money.", month: 11, day: 18 },
    { key: "prototype", title: "Prototype", description: "Make the first version of your product or service and get feedback on it.", month: 1, day: 13 },
    { key: "pilot", title: "Pilot", description: "Test with real customers: a first sale, a trial run or a sign-up list. Record what happened.", month: 2, day: 31 },
    { key: "pitch", title: "Improve and pitch", description: "Improve from what you learned, then prepare a 2-minute pitch for Launch Day.", month: 3, day: 30 },
    { key: "launch", title: "Launch Day and presentation", description: "Launch your business and present it to the school community.", month: 4, day: 0 },
    { key: "reflection", title: "Reflection", description: "What worked, what didn't, and what you'd do next. Add your best evidence to your portfolio.", month: 5, day: 15 },
  ],
  PURPOSE: [
    { key: "discovery", title: "Discover your cause", description: "Answer the discovery questions and choose a cause and project that matter to you.", month: 8, day: 30 },
    { key: "proposal", title: "Proposal", description: "Describe the problem, who it affects, and what you'll do about it. Your coach approves it.", month: 9, day: 31 },
    { key: "research", title: "Research", description: "Find facts about the problem, what others already do, and talk to at least 3 people it affects.", month: 10, day: 30 },
    { key: "partners", title: "Partners and plan", description: "Find an adult or organization to partner with, and plan your steps and what you'll need.", month: 11, day: 18 },
    { key: "action", title: "First action", description: "Take your first real action: an event, a drive, a campaign, a build. Record what you did.", month: 1, day: 13 },
    { key: "impact", title: "Measure your impact", description: "Count what changed: people helped, items collected, minds changed. Show the numbers.", month: 2, day: 31 },
    { key: "grow", title: "Grow and prepare", description: "Do more of what worked, then prepare a 2-minute presentation for Launch Day.", month: 3, day: 30 },
    { key: "launch", title: "Launch Day and presentation", description: "Share your project and its impact with the school community.", month: 4, day: 0 },
    { key: "reflection", title: "Reflection", description: "What you learned about yourself and your community, and how the work can continue.", month: 5, day: 15 },
  ],
};

const weekdayOnOrBefore = (d: Date) => addDays(d, -Math.max(0, weekdayIndex(d) - 4));

/** Default Launch Day: the third Thursday of May. */
export function defaultLaunchDay(schoolYear: number): Date {
  const may1 = utcDate(schoolYear + 1, 4, 1);
  const firstThu = addDays(may1, (3 - weekdayIndex(may1) + 7) % 7);
  return addDays(firstThu, 14);
}

/**
 * Due dates for a project's milestones. A student who starts late gets a compressed schedule:
 * every milestone is at least a week after the previous one and at least a week from today.
 */
export function milestoneDates(type: ProjectTypeName, schoolYear: number, launchDay: Date, today: Date): Date[] {
  const out: Date[] = [];
  let prev = addDays(today, 0);
  MILESTONES[type].forEach((m, i) => {
    const y = m.month >= 8 ? schoolYear : schoolYear + 1;
    let d = m.key === "launch" ? launchDay : weekdayOnOrBefore(utcDate(y, m.month, m.day));
    const min = addDays(i === 0 ? today : prev, 7);
    if (d < min) d = weekdayOnOrBefore(addDays(min, 2)) < min ? min : weekdayOnOrBefore(addDays(min, 2));
    out.push(d);
    prev = d;
  });
  return out;
}

export type Idea = { title: string; oneLiner: string; whyYou: string; firstSteps: string[] };
