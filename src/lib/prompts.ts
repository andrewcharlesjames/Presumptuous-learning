// Daily prompts for the non-academic blocks. Rotated by date so every student in a school sees the same one each day.

export const MOODS = [
  { v: 5, label: "Great" }, { v: 4, label: "Good" }, { v: 3, label: "Okay" }, { v: 2, label: "Low" }, { v: 1, label: "Rough" },
] as const;
export const moodLabel = (v: number | null | undefined) => MOODS.find(m => m.v === v)?.label ?? "—";

export const EFFORT = [
  { v: 1, label: "Took it easy" }, { v: 2, label: "Steady" }, { v: 3, label: "Pushed myself" }, { v: 4, label: "Overreached" },
] as const;
export const effortLabel = (v: number | null | undefined) => EFFORT.find(e => e.v === v)?.label ?? "—";

const MINDFUL = [
  "Breathe in for 4 counts, hold for 4, out for 4. Do it 4 times.",
  "Notice 5 things you can see, 4 you can hear, 3 you can feel.",
  "Close your eyes and picture one thing you're looking forward to today.",
  "Squeeze your hands into fists for 5 seconds, then let go. Feel the difference.",
  "Think of one person who helped you this week. Silently thank them.",
  "Sit tall, drop your shoulders, and take three slow breaths.",
  "Name the feeling you have right now. Just notice it. No need to change it.",
];

type Band = "younger" | "older";
const band = (grade: number): Band => (grade <= 5 ? "younger" : "older");

const ARTS: Record<Band, string[]> = {
  younger: [
    "Draw your favourite animal using only circles and triangles.",
    "Make up a 4-beat rhythm with claps and stomps. Teach it to someone.",
    "Act out a seed growing into a tall tree, without words.",
    "Draw a map of a pretend island. Give every place a name.",
    "Hum a happy tune, then hum it slowly so it sounds sleepy.",
    "Make a picture using only warm colours: red, orange and yellow.",
    "Move like the weather: sunshine, then a storm, then snow.",
    "Draw what your street would look like in 100 years.",
    "Find three textures at home or school. Make a rubbing of each with a crayon.",
    "Create a character and give them a funny voice. Tell one line in their voice.",
  ],
  older: [
    "Sketch an everyday object from three different angles.",
    "Write a 4-line poem using only words that describe sound.",
    "Photograph or sketch something ordinary to make it look dramatic.",
    "Create a 30-second movement sequence that shows a feeling without words.",
    "Design a logo for a business you'd like to start one day.",
    "Compose a 4-bar rhythm and write it down using notes or your own symbols.",
    "Draw a scene using one-point perspective: a hallway, road or train track.",
    "Write a monologue of 5 sentences from the point of view of an object in your room.",
    "Make a mood board (drawn or collected) for a short film you'd like to make.",
    "Recreate a famous artwork using things you find around you.",
  ],
};

/** Monday–Friday tracks, from the life-skills program. */
export const LIFE_TRACKS = ["Financial literacy", "Entrepreneurship", "Leadership", "Personal development", "Project time"] as const;
const LIFE: Record<Band, string[][]> = {
  younger: [
    ["List 3 things you need and 3 things you want. What's the difference?", "If you had $10, how would you split it between saving, spending and giving?", "Count the coins in a pile (real or drawn). How much is there in total?"],
    ["Think of a problem at school. What could you make or do to fix it?", "Design a lemonade stand: what's it called, and what does a cup cost?", "Draw a poster to sell your favourite snack."],
    ["Help someone today without being asked. What did you do?", "Lead a game at recess and make sure everyone gets a turn.", "What makes a good team captain? List 3 things."],
    ["Write one thing you're proud of this week.", "What's a mistake that helped you learn something?", "Make a plan for something you want to get better at."],
    ["Work on your class project or start one about something you care about.", "Share your project idea with a friend and ask for one suggestion.", "Draw what your finished project will look like."],
  ],
  older: [
    ["Track everything you spend money on today. What surprised you?", "Compare the unit price of two sizes of the same product. Which is the better deal?", "Make a simple monthly budget for a part-time job paying $300 a month."],
    ["Pick a problem people your age have. Write a one-sentence business idea that solves it.", "Who would buy your idea? Describe your customer in 3 sentences.", "Write a 30-second pitch for your idea and say it out loud."],
    ["Describe a leader you admire. What do they do that you could practice?", "Run a 5-minute group discussion and make sure every person speaks.", "Give someone specific, kind feedback on their work."],
    ["Set one SMART goal for this week. Make it specific and measurable.", "Plan tomorrow in 15-minute blocks. Where does your time go?", "Write about a setback and what you'd do differently next time."],
    ["Spend this block on your Presumptuous or Purpose project. Write down your next step.", "Contact one person who could help with your project.", "Write a progress update: done, doing, next."],
  ],
};

const dayIndex = (d: Date) => Math.floor(d.getTime() / 86400000);

export function mindfulnessFor(d: Date) {
  return MINDFUL[dayIndex(d) % MINDFUL.length];
}
export function artsPromptFor(d: Date, grade: number) {
  const list = ARTS[band(grade)];
  return list[dayIndex(d) % list.length];
}
/** weekday: 0 = Monday */
export function lifePromptFor(d: Date, grade: number, weekday: number) {
  const w = Math.min(4, Math.max(0, weekday));
  const list = LIFE[band(grade)][w];
  return { track: LIFE_TRACKS[w], prompt: list[Math.floor(dayIndex(d) / 7) % list.length] };
}
