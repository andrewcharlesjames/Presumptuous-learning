// The Presumptuous Project's learning strand: Entrepreneurship & Life Skills, K–12.
// Ten monthly units, September to June, each lined up with that month's project step,
// so students learn a skill and then use it on their own business.
// Pitched younger than the Ontario standard on purpose: K–2 already meet price, cost and profit.

export const ENT = "ent" as const;
export const ENT_NAME = "Entrepreneurship & Life Skills";

export type Band = 0 | 1 | 2 | 3;
export const BAND_LABEL = ["K–2", "Grades 3–5", "Grades 6–8", "Grades 9–12"] as const;
export const bandOf = (grade: number): Band => (grade <= 2 ? 0 : grade <= 5 ? 1 : grade <= 8 ? 2 : 3);

export type Unit = {
  month: number; // 0 = January
  title: string;
  step: string; // the project milestone key it prepares for
  apply: string; // what to do on your own project, {project} = its title
  links: string[]; // Ontario curriculum connections (elementary)
  business: [string, string][]; // by band: two business skills
  life: string[]; // by band: one life skill
};

export const UNITS: Unit[] = [
  { month: 8, title: "Spot a problem worth solving", step: "discovery", apply: "List three problems you've noticed this week. Which one would people pay to fix?",
    links: ["Language: oral communication", "Social Studies: communities"],
    business: [["Needs and wants", "Noticing problems around us"], ["Problems and solutions", "What makes a good idea"], ["Finding problems people will pay to solve", "Brainstorming and choosing ideas"], ["Opportunity recognition", "Idea screening and validation"]],
    life: ["Sharing and taking turns", "Setting a goal", "SMART goals", "Personal goals and motivation"] },
  { month: 9, title: "Customers and value", step: "proposal", apply: "Describe your customer in one sentence, and say why they'd choose {project}.",
    links: ["Language: oral and written communication"],
    business: [["Who is a customer?", "Making something people like"], ["Who are my customers?", "What makes my product special"], ["Target customers", "Value proposition"], ["Customer segments and personas", "Value proposition design"]],
    life: ["Saying please and thank you", "Speaking clearly to adults", "Professional communication", "Networking and professional email"] },
  { month: 10, title: "Ask your customers", step: "research", apply: "Write three questions for your customers, ask five people, and count their answers.",
    links: ["Mathematics: data (surveys and graphs)", "Language: oral communication"],
    business: [["Asking good questions", "Counting with tally charts"], ["Making a simple survey", "Reading a graph of answers"], ["Survey design", "Analyzing survey data"], ["Market research methods", "Market size and competitors"]],
    life: ["Listening carefully", "Active listening", "Handling feedback", "Receiving criticism with a growth mindset"] },
  { month: 11, title: "Money: costs, prices and profit", step: "plan", apply: "List what {project} costs to make, choose a price, and work out the profit on one sale.",
    links: ["Mathematics: financial literacy", "Mathematics: number"],
    business: [["Coins and bills", "Price, cost and profit at a lemonade stand"], ["Costs and prices", "Profit per sale"], ["Fixed and variable costs", "Pricing and profit margin"], ["Break-even analysis", "Budgets and cash flow"]],
    life: ["Saving for something", "Saving and spending plans", "Budgeting", "Personal budgeting and credit"] },
  { month: 0, title: "Design and build", step: "prototype", apply: "Make the first version of {project}, show it to two people, and write down one thing to improve.",
    links: ["Science & Technology: design and problem solving"],
    business: [["Plan, make, test", "Trying again when it doesn't work"], ["Prototypes", "Testing and improving"], ["Design thinking", "Minimum viable product"], ["Rapid prototyping and MVPs", "Iterating from user feedback"]],
    life: ["Being patient", "Perseverance", "Resilience after failure", "Managing stress and setbacks"] },
  { month: 1, title: "Teamwork and leadership", step: "prototype", apply: "Who could help with {project}? Give one person a clear job and check in with them this week.",
    links: ["Health & Physical Education: interpersonal skills"],
    business: [["Working as a team", "Jobs in a business"], ["Roles on a team", "Leading a small group"], ["Team roles and delegation", "Running a meeting"], ["Leadership styles", "Managing a team and delegating"]],
    life: ["Being a good helper", "Solving disagreements", "Conflict resolution", "Negotiation"] },
  { month: 2, title: "Marketing and selling", step: "pilot", apply: "Make one sign or post for {project}, and make your first real sale or sign-up.",
    links: ["Language: media literacy and persuasive writing"],
    business: [["Signs and posters", "Telling people about your idea"], ["Advertising", "Making a sale"], ["Marketing channels and branding", "Sales and customer service"], ["The marketing mix (4 Ps)", "Sales funnels and digital marketing"]],
    life: ["Being honest", "Honesty and fairness in business", "Digital citizenship and online safety", "Ethics and consumer protection"] },
  { month: 3, title: "Pitch it", step: "pitch", apply: "Write a 2-minute pitch for {project}: the problem, your solution, your customer and your ask. Practise it out loud.",
    links: ["Language: oral communication (presenting)", "Language: persuasive writing"],
    business: [["Show and tell your idea", "Speaking in front of others"], ["Telling your business story", "Making a 2-minute pitch"], ["Structure of a pitch", "Persuasive presentations"], ["Investor pitch structure", "Answering tough questions"]],
    life: ["Being brave", "Confidence speaking in public", "Public speaking", "Interview skills"] },
  { month: 4, title: "Launch!", step: "launch", apply: "Make your Launch Day checklist for {project}, and keep a record of every sale and cost.",
    links: ["Mathematics: financial literacy", "Mathematics: data"],
    business: [["Getting ready for Launch Day", "Counting your money"], ["Launch checklist", "Keeping track of sales"], ["Operations and logistics", "Recording sales and expenses"], ["Operations planning", "Financial records and simple statements"]],
    life: ["Taking care of your things", "Time management", "Planning your time", "Taxes, HST and paying yourself"] },
  { month: 5, title: "Results and what's next", step: "reflection", apply: "Did {project} make a profit? What would you keep, change or stop next year?",
    links: ["Mathematics: financial literacy", "Language: reflective writing"],
    business: [["Did we make a profit?", "What I learned"], ["Profit or loss?", "Reflecting on my business"], ["Measuring success", "Growing or pivoting"], ["Evaluating results", "Scaling, pivoting or closing"]],
    life: ["Giving back", "Sharing and giving", "Saving, investing and giving", "Investing and compound interest"] },
];

const HIGH_SCHOOL_LINKS = ["Business Studies (BBI1O/BBI2O)", "Career Studies (GLC2O)"];

export type EntSkill = { skill: string; kind: "business" | "life"; unit: Unit };

/** The unit for a calendar date (July and August fall back to June's). */
export function unitFor(date: Date): Unit {
  const m = date.getUTCMonth();
  return UNITS.find(u => u.month === m) ?? UNITS[UNITS.length - 1];
}

export function skillsOf(unit: Unit, grade: number): EntSkill[] {
  const b = bandOf(grade);
  return [...unit.business[b].map(skill => ({ skill, kind: "business" as const, unit })), { skill: unit.life[b], kind: "life" as const, unit }];
}

export const linksFor = (unit: Unit, grade: number) => (grade >= 9 ? [...unit.links, ...HIGH_SCHOOL_LINKS] : unit.links);

/** Months of the school year in order, September first. */
const ORDER = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5];
const rank = (month: number) => ORDER.indexOf(month);

/** Every skill from September up to and including the unit for `date`. */
export function skillsSoFar(date: Date, grade: number): EntSkill[] {
  const upTo = rank(unitFor(date).month);
  return UNITS.filter(u => rank(u.month) <= upTo).flatMap(u => skillsOf(u, grade));
}

/** Skills taught between two dates (inclusive), for a report term. */
export function skillsBetween(from: Date, to: Date, grade: number): EntSkill[] {
  const a = rank(unitFor(from).month), z = rank(unitFor(to).month);
  return UNITS.filter(u => rank(u.month) >= a && rank(u.month) <= z).flatMap(u => skillsOf(u, grade));
}

/** The next skill to learn this month: the first one not yet mastered (or null when the month is done). */
export function nextSkill(date: Date, grade: number, mastered: Set<string>): EntSkill | null {
  return skillsOf(unitFor(date), grade).find(s => !mastered.has(`${ENT}|${s.skill}`)) ?? null;
}

export const applyText = (unit: Unit, projectTitle?: string | null) => unit.apply.replaceAll("{project}", projectTitle?.trim() || "your business");

/** Finds a skill anywhere in the strand (any grade band), with the unit it belongs to. */
export function findEntSkill(skill: string): { unit: Unit; kind: "business" | "life" } | null {
  for (const unit of UNITS) {
    if (unit.business.some(pair => pair.includes(skill))) return { unit, kind: "business" };
    if (unit.life.includes(skill)) return { unit, kind: "life" };
  }
  return null;
}
