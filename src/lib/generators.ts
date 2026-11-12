// Math questions generated from a seed: endless fresh practice, each with a worked explanation.
// Ids look like "gen:math:<generator>:<seed>" and regenerate identically, so nothing is stored.
import type { BankItem } from "./assessment.ts";

type Rng = () => number;
type Gen = { id: string; grade: number; strand: string; skill: string; make: (r: Rng) => { prompt: string; answer: string; wrong: string[]; explain: string } };

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)];
/** Display with a true minus sign and thousands separators. */
const n = (x: number) => (x < 0 ? "−" : "") + Math.abs(x).toLocaleString("en-CA", { maximumFractionDigits: 4 });
const dec = (x: number, places = 2) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(places);
const money = (x: number) => `$${x.toLocaleString("en-CA", { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** Three distinct wrong answers from candidates, topped up with nearby numbers if needed. */
function wrongs(answer: string, candidates: string[], filler: () => string): string[] {
  const out: string[] = [];
  for (const c of candidates) if (c !== answer && !out.includes(c)) out.push(c);
  for (let guard = 0; out.length < 3 && guard < 50; guard++) { const f = filler(); if (f !== answer && !out.includes(f)) out.push(f); }
  return out.slice(0, 3);
}

const GENS: Gen[] = [
  { id: "count", grade: 0, strand: "Number", skill: "Counting objects", make: r => {
    const k = int(r, 3, 10);
    return { prompt: `How many stars? ${"★ ".repeat(k).trim()}`, answer: n(k), wrong: wrongs(n(k), [n(k - 1), n(k + 1), n(k + 2)], () => n(int(r, 1, 12))),
      explain: `Touch each star once as you count: 1, 2, 3 … up to ${k}.` };
  } },
  { id: "add20", grade: 1, strand: "Number", skill: "Adding within 20", make: r => {
    const a = int(r, 2, 12), b = int(r, 2, 20 - a);
    return { prompt: `${a} + ${b} = ?`, answer: n(a + b), wrong: wrongs(n(a + b), [n(a + b - 1), n(a + b + 1), n(Math.abs(a - b))], () => n(int(r, 2, 20))),
      explain: `Start at ${a} and count on ${b} more: ${a} + ${b} = ${a + b}.` };
  } },
  { id: "sub20", grade: 1, strand: "Number", skill: "Subtracting within 20", make: r => {
    const a = int(r, 8, 20), b = int(r, 1, a - 1);
    return { prompt: `${a} − ${b} = ?`, answer: n(a - b), wrong: wrongs(n(a - b), [n(a - b + 1), n(a - b - 1), n(a + b)], () => n(int(r, 0, 20))),
      explain: `Count back ${b} from ${a}, or think: what plus ${b} makes ${a}? ${a - b} + ${b} = ${a}.` };
  } },
  { id: "add2d", grade: 2, strand: "Number", skill: "Adding two-digit numbers", make: r => {
    const a = int(r, 15, 68), b = int(r, 12, 99 - a);
    const noCarry = Math.floor(a / 10) * 10 + Math.floor(b / 10) * 10 + ((a % 10 + b % 10) % 10);
    return { prompt: `${a} + ${b} = ?`, answer: n(a + b), wrong: wrongs(n(a + b), [n(noCarry), n(a + b + 10), n(a + b - 1)], () => n(int(r, 30, 99))),
      explain: `Add the tens: ${Math.floor(a / 10) * 10} + ${Math.floor(b / 10) * 10} = ${(Math.floor(a / 10) + Math.floor(b / 10)) * 10}. Add the ones: ${a % 10} + ${b % 10} = ${a % 10 + b % 10}. Together: ${a + b}.` };
  } },
  { id: "sub2d", grade: 2, strand: "Number", skill: "Subtracting two-digit numbers", make: r => {
    const a = int(r, 40, 99), b = int(r, 11, a - 10);
    return { prompt: `${a} − ${b} = ?`, answer: n(a - b), wrong: wrongs(n(a - b), [n(a - b + 10), n(a - b - 10), n(a - b + 1)], () => n(int(r, 5, 90))),
      explain: `Check by adding: ${a - b} + ${b} = ${a}.` };
  } },
  { id: "mult", grade: 3, strand: "Number", skill: "Multiplication facts", make: r => {
    const a = int(r, 2, 9), b = int(r, 2, 9);
    return { prompt: `${a} × ${b} = ?`, answer: n(a * b), wrong: wrongs(n(a * b), [n(a + b), n(a * (b + 1)), n((a - 1) * b)], () => n(int(r, 4, 81))),
      explain: `${a} × ${b} means ${b} groups of ${a}: ${Array(b).fill(a).join(" + ")} = ${a * b}.` };
  } },
  { id: "div", grade: 3, strand: "Number", skill: "Division facts", make: r => {
    const a = int(r, 2, 9), b = int(r, 2, 9);
    return { prompt: `${a * b} ÷ ${a} = ?`, answer: n(b), wrong: wrongs(n(b), [n(b + 1), n(b - 1), n(a)], () => n(int(r, 1, 12))),
      explain: `Think multiplication: ${a} × ? = ${a * b}. Since ${a} × ${b} = ${a * b}, the answer is ${b}.` };
  } },
  { id: "rectper", grade: 3, strand: "Spatial Sense", skill: "Perimeter", make: r => {
    const l = int(r, 3, 12), w = int(r, 2, l);
    return { prompt: `A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter?`, answer: `${2 * (l + w)} cm`,
      wrong: wrongs(`${2 * (l + w)} cm`, [`${l * w} cm`, `${l + w} cm`, `${2 * l + w} cm`], () => `${int(r, 8, 50)} cm`),
      explain: `Perimeter is the distance all the way around: ${l} + ${w} + ${l} + ${w} = ${2 * (l + w)} cm.` };
  } },
  { id: "mult1d", grade: 4, strand: "Number", skill: "Multi-digit multiplication", make: r => {
    const a = int(r, 12, 98), b = int(r, 3, 9);
    return { prompt: `${a} × ${b} = ?`, answer: n(a * b), wrong: wrongs(n(a * b), [n(a * b - 10 * b), n(a * b + b), n(a + b)], () => n(int(r, 40, 800))),
      explain: `Split ${a} into ${Math.floor(a / 10) * 10} + ${a % 10}: ${Math.floor(a / 10) * 10} × ${b} = ${Math.floor(a / 10) * 10 * b}, ${a % 10} × ${b} = ${(a % 10) * b}. Add them: ${a * b}.` };
  } },
  { id: "area", grade: 4, strand: "Spatial Sense", skill: "Area of rectangles", make: r => {
    const l = int(r, 3, 15), w = int(r, 2, 12);
    return { prompt: `What is the area of a rectangle ${l} m long and ${w} m wide?`, answer: `${l * w} m²`,
      wrong: wrongs(`${l * w} m²`, [`${2 * (l + w)} m²`, `${l + w} m²`, `${l * w + l} m²`], () => `${int(r, 10, 150)} m²`),
      explain: `Area = length × width = ${l} × ${w} = ${l * w} square metres.` };
  } },
  { id: "tenths", grade: 4, strand: "Number", skill: "Decimal tenths", make: r => {
    const k = int(r, 1, 9);
    return { prompt: `Which decimal equals ${k}/10?`, answer: `0.${k}`, wrong: wrongs(`0.${k}`, [`0.0${k}`, `${k}.0`, `${k}0`], () => `0.${int(r, 1, 9)}`),
      explain: `${k}/10 means ${k} tenths. Tenths are the first place after the decimal point: 0.${k}.` };
  } },
  { id: "decadd", grade: 5, strand: "Number", skill: "Adding decimals", make: r => {
    const a = int(r, 105, 899) / 100, b = int(r, 11, 99) / 10;
    const s = Math.round((a + b) * 100) / 100;
    return { prompt: `${dec(a)} + ${dec(b, 1)} = ?`, answer: dec(s), wrong: wrongs(dec(s), [dec(a + b / 10), dec(s + 1), dec(s - 0.1)], () => dec(int(r, 200, 1800) / 100)),
      explain: `Line up the decimal points: ${dec(a)} + ${dec(b, 2)} = ${dec(s)}.` };
  } },
  { id: "equivfrac", grade: 5, strand: "Number", skill: "Equivalent fractions", make: r => {
    const d = pick(r, [3, 4, 5, 6, 8]), num = int(r, 1, d - 1), k = int(r, 2, 4);
    const ans = `${num * k}/${d * k}`;
    return { prompt: `Which fraction is equal to ${num}/${d}?`, answer: ans, wrong: wrongs(ans, [`${num + k}/${d + k}`, `${num * k}/${d}`, `${num}/${d * k}`], () => `${int(r, 1, 9)}/${int(r, 10, 20)}`),
      explain: `Multiply the top and bottom by the same number (${k}): ${num}×${k} = ${num * k}, ${d}×${k} = ${d * k}.` };
  } },
  { id: "tri", grade: 5, strand: "Spatial Sense", skill: "Area of triangles", make: r => {
    const b = 2 * int(r, 2, 10), h = int(r, 3, 12);
    return { prompt: `A triangle has a base of ${b} cm and a height of ${h} cm. What is its area?`, answer: `${(b * h) / 2} cm²`,
      wrong: wrongs(`${(b * h) / 2} cm²`, [`${b * h} cm²`, `${b + h} cm²`, `${(b + h) / 2} cm²`], () => `${int(r, 6, 120)} cm²`),
      explain: `Area of a triangle = base × height ÷ 2 = ${b} × ${h} ÷ 2 = ${(b * h) / 2} cm².` };
  } },
  { id: "pct", grade: 6, strand: "Number", skill: "Percent", make: r => {
    const p = pick(r, [10, 20, 25, 50, 75, 5, 30]), base = pick(r, [20, 40, 60, 80, 120, 200, 360]);
    const a = (p * base) / 100;
    return { prompt: `What is ${p}% of ${base}?`, answer: n(a), wrong: wrongs(n(a), [n(base - a), n(p), n(a * 2)], () => n(int(r, 2, 200))),
      explain: `${p}% means ${p} out of 100. ${base} × ${p} ÷ 100 = ${a}.` };
  } },
  { id: "ratio", grade: 6, strand: "Number", skill: "Ratios and rates", make: r => {
    const a = int(r, 2, 5), b = int(r, a + 1, 9), k = int(r, 2, 6);
    return { prompt: `A recipe uses ${a} cups of flour for every ${b} cups of milk. How much flour goes with ${b * k} cups of milk?`, answer: `${a * k} cups`,
      wrong: wrongs(`${a * k} cups`, [`${b * k - (b - a)} cups`, `${a + k} cups`, `${b * k} cups`], () => `${int(r, 2, 40)} cups`),
      explain: `${b * k} cups of milk is ${k} times ${b}. Multiply the flour by ${k} too: ${a} × ${k} = ${a * k} cups.` };
  } },
  { id: "eq1", grade: 6, strand: "Algebra", skill: "Solving equations", make: r => {
    const a = int(r, 2, 9), x = int(r, 2, 12), b = int(r, 1, 20);
    return { prompt: `If ${a}n + ${b} = ${a * x + b}, what is n?`, answer: n(x), wrong: wrongs(n(x), [n(x + 1), n(a * x), n(Math.round((a * x + b) / a))], () => n(int(r, 1, 20))),
      explain: `Subtract ${b} from both sides: ${a}n = ${a * x}. Divide by ${a}: n = ${x}.` };
  } },
  { id: "int", grade: 7, strand: "Number", skill: "Integer operations", make: r => {
    const a = int(r, -15, 15), b = int(r, -15, 15), op = pick(r, ["+", "−"]);
    const v = op === "+" ? a + b : a - b;
    const show = (x: number) => (x < 0 ? `(${n(x)})` : n(x));
    return { prompt: `${show(a)} ${op} ${show(b)} = ?`, answer: n(v), wrong: wrongs(n(v), [n(-v), n(op === "+" ? a - b : a + b), n(v + 2)], () => n(int(r, -30, 30))),
      explain: op === "+" ? `Start at ${n(a)} on a number line and move ${b >= 0 ? "right" : "left"} ${Math.abs(b)}: ${n(v)}.` : `Subtracting is adding the opposite: ${show(a)} + ${show(-b)} = ${n(v)}.` };
  } },
  { id: "linrel", grade: 7, strand: "Algebra", skill: "Linear relations", make: r => {
    const base = int(r, 2, 6), per = int(r, 2, 5), k = int(r, 3, 12);
    return { prompt: `A taxi charges $${base} plus $${per} per km. What does a ${k} km ride cost?`, answer: money(base + per * k),
      wrong: wrongs(money(base + per * k), [money(per * k), money((base + per) * k), money(base * k + per)], () => money(int(r, 10, 80))),
      explain: `Cost = ${base} + ${per} × ${k} = ${base} + ${per * k} = $${base + per * k}.` };
  } },
  { id: "exp", grade: 8, strand: "Number", skill: "Exponents", make: r => {
    const b = int(r, 2, 6), e = int(r, 2, b <= 3 ? 6 : 3);
    const v = b ** e;
    return { prompt: `What is ${b}${["", "", "²", "³", "⁴", "⁵", "⁶"][e]}?`, answer: n(v), wrong: wrongs(n(v), [n(b * e), n(b ** (e - 1)), n(v + b)], () => n(int(r, 4, 300))),
      explain: `Multiply ${b} by itself ${e} times: ${Array(e).fill(b).join(" × ")} = ${v}.` };
  } },
  { id: "pyth", grade: 8, strand: "Spatial Sense", skill: "Pythagorean theorem", make: r => {
    const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [9, 12, 15], [7, 24, 25]]);
    return { prompt: `A right triangle has legs of ${a} cm and ${b} cm. How long is the hypotenuse?`, answer: `${c} cm`,
      wrong: wrongs(`${c} cm`, [`${a + b} cm`, `${c + 1} cm`, `${a * b} cm`], () => `${int(r, 5, 30)} cm`),
      explain: `a² + b² = c²: ${a * a} + ${b * b} = ${c * c}, and √${c * c} = ${c}.` };
  } },
  { id: "eq2", grade: 8, strand: "Algebra", skill: "Multi-step equations", make: r => {
    const a = int(r, 2, 6), b = int(r, 1, 9), x = int(r, b + 1, b + 12);
    return { prompt: `Solve: ${a}(x − ${b}) = ${a * (x - b)}`, answer: `x = ${x}`,
      wrong: wrongs(`x = ${x}`, [`x = ${x - b}`, `x = ${x - 2 * b}`, `x = ${a * (x - b) - b}`], () => `x = ${int(r, 1, 30)}`),
      explain: `Divide both sides by ${a}: x − ${b} = ${x - b}. Add ${b}: x = ${x}.` };
  } },
  { id: "slope", grade: 9, strand: "Linear & Non-linear Relations", skill: "Slope", make: r => {
    const m = pick(r, [1, 2, 3, 4, -1, -2, -3]), x1 = int(r, -3, 3), y1 = int(r, -5, 5), dx = int(r, 1, 4);
    const x2 = x1 + dx, y2 = y1 + m * dx;
    return { prompt: `What is the slope of the line through (${n(x1)}, ${n(y1)}) and (${n(x2)}, ${n(y2)})?`, answer: n(m),
      wrong: wrongs(n(m), [n(-m), `1/${n(m)}`, n(m * dx)], () => n(int(r, -5, 5))),
      explain: `Slope = rise ÷ run = (${n(y2)} − ${n(y1)}) ÷ (${n(x2)} − ${n(x1)}) = ${n(m * dx)} ÷ ${dx} = ${n(m)}.` };
  } },
  { id: "like", grade: 9, strand: "Algebra", skill: "Simplifying expressions", make: r => {
    const a = int(r, 2, 9), b = int(r, 1, a - 1), c = int(r, 1, 9), d = int(r, 1, 9);
    const ans = `${a - b === 1 ? "" : a - b}x + ${c + d}`;
    return { prompt: `Simplify: ${a}x + ${c} − ${b}x + ${d}`, answer: ans,
      wrong: wrongs(ans, [`${a + b}x + ${c + d}`, `${a - b}x + ${Math.abs(c - d)}`, `${a - b + c + d}x`], () => `${int(r, 2, 9)}x + ${int(r, 2, 18)}`),
      explain: `Group like terms: (${a}x − ${b}x) + (${c} + ${d}) = ${ans}.` };
  } },
  { id: "interest", grade: 9, strand: "Financial Literacy", skill: "Simple interest", make: r => {
    const P = pick(r, [200, 500, 800, 1000, 1500, 2000]), rate = pick(r, [2, 3, 4, 5, 6]), t = int(r, 2, 5);
    const I = (P * rate * t) / 100;
    return { prompt: `${money(P)} is invested at ${rate}% simple interest per year. How much interest is earned in ${t} years?`, answer: money(I),
      wrong: wrongs(money(I), [money(I / t), money(P + I), money(I * 2)], () => money(int(r, 10, 600))),
      explain: `Interest = principal × rate × time = ${P} × ${rate / 100} × ${t} = $${I}.` };
  } },
  { id: "factor", grade: 10, strand: "Quadratic Relations", skill: "Factoring trinomials", make: r => {
    const a = int(r, 1, 7), b = int(r, a, 9);
    const t = (x: number) => (x < 0 ? `− ${-x}` : `+ ${x}`);
    const ans = `(x ${t(a)})(x ${t(b)})`;
    return { prompt: `Factor: x² + ${a + b}x + ${a * b}`, answer: ans,
      wrong: wrongs(ans, [`(x ${t(-a)})(x ${t(-b)})`, `(x ${t(1)})(x ${t(a * b)})`, `(x ${t(a + b)})(x ${t(1)})`], () => `(x + ${int(r, 1, 9)})(x + ${int(r, 1, 9)})`),
      explain: `Find two numbers that multiply to ${a * b} and add to ${a + b}: ${a} and ${b}. So x² + ${a + b}x + ${a * b} = ${ans}.` };
  } },
  { id: "system", grade: 10, strand: "Analytic Geometry", skill: "Linear systems", make: r => {
    const x = int(r, 1, 9), y = int(r, 1, 9);
    const ans = `x = ${x}, y = ${y}`;
    return { prompt: `Solve: x + y = ${x + y} and x − y = ${n(x - y)}`, answer: ans,
      wrong: wrongs(ans, [`x = ${y}, y = ${x}`, `x = ${x + 1}, y = ${y - 1}`, `x = ${x + y}, y = ${x - y}`], () => `x = ${int(r, 1, 9)}, y = ${int(r, 1, 9)}`),
      explain: `Add the equations: 2x = ${2 * x}, so x = ${x}. Then y = ${x + y} − ${x} = ${y}.` };
  } },
  { id: "fnotation", grade: 11, strand: "Functions", skill: "Function notation", make: r => {
    const a = int(r, 1, 4), c = int(r, -9, 9), x = int(r, -4, 4);
    const v = a * x * x + c;
    const cs = c < 0 ? `− ${-c}` : `+ ${c}`;
    return { prompt: `If f(x) = ${a === 1 ? "" : a}x² ${cs}, what is f(${n(x)})?`, answer: n(v),
      wrong: wrongs(n(v), [n(-a * x * x + c), n(a * 2 * x + c), n(v + 2 * a)], () => n(int(r, -20, 60))),
      explain: `Replace x with ${n(x)}: ${a} × (${n(x)})² ${cs} = ${a} × ${x * x} ${cs} = ${n(v)}.` };
  } },
  { id: "explaws", grade: 11, strand: "Exponential Functions", skill: "Exponent laws", make: r => {
    const a = int(r, 2, 7), b = int(r, 2, 7), c = int(r, 1, a + b - 1);
    const sup = (k: number) => String(k).split("").map(d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]).join("");
    const ans = `x${sup(a + b - c)}`;
    return { prompt: `Simplify: (x${sup(a)})(x${sup(b)}) ÷ x${sup(c)}`, answer: ans,
      wrong: wrongs(ans, [`x${sup(a * b - c)}`, `x${sup(a + b + c)}`, `x${sup(Math.max(1, a * b / c | 0))}`], () => `x${sup(int(r, 1, 14))}`),
      explain: `Multiplying adds exponents (${a} + ${b} = ${a + b}); dividing subtracts (${a + b} − ${c} = ${a + b - c}).` };
  } },
  { id: "log", grade: 12, strand: "Exponential & Logarithmic Functions", skill: "Logarithms", make: r => {
    const b = pick(r, [2, 3, 5, 10]), k = int(r, 2, b === 2 ? 7 : 4);
    const sub = (x: number) => String(x).split("").map(d => "₀₁₂₃₄₅₆₇₈₉"[+d]).join("");
    return { prompt: `What is log${sub(b)}(${n(b ** k)})?`, answer: n(k), wrong: wrongs(n(k), [n(k + 1), n(b ** k / b), n(k - 1)], () => n(int(r, 1, 9))),
      explain: `log${sub(b)}(${n(b ** k)}) asks: ${b} to what power is ${n(b ** k)}? ${b}^${k} = ${n(b ** k)}, so the answer is ${k}.` };
  } },
  { id: "deriv", grade: 12, strand: "Rates of Change", skill: "Derivatives", make: r => {
    const a = int(r, 1, 9), p = int(r, 2, 6);
    const sup = (k: number) => k === 1 ? "" : String(k).split("").map(d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]).join("");
    const term = (c: number, e: number) => `${c === 1 ? "" : c}x${sup(e)}`;
    const ans = term(a * p, p - 1);
    return { prompt: `What is the derivative of f(x) = ${term(a, p)}?`, answer: ans,
      wrong: wrongs(ans, [term(a, p - 1), term(a * p, p), term(a * (p - 1), p - 1)], () => term(int(r, 1, 30), int(r, 1, 5))),
      explain: `Power rule: multiply by the exponent and lower it by one. ${a} × ${p} = ${a * p}, and x${sup(p)} becomes x${sup(p - 1) || ""}.` };
  } },
];

export const GENERATORS = GENS.map(({ id, grade, strand, skill }) => ({ id, grade, strand, skill }));

export function isGeneratedId(id: string): boolean {
  return id.startsWith("gen:");
}

export function generatedItem(id: string): BankItem | undefined {
  const m = /^gen:math:([a-z0-9]+):(\d+)$/.exec(id);
  if (!m) return undefined;
  const g = GENS.find(x => x.id === m[1]);
  if (!g) return undefined;
  const out = g.make(mulberry32(+m[2]));
  if (out.wrong.length < 3) return undefined;
  return {
    id, sid: "math", grade: g.grade, strand: g.strand, skill: g.skill, prompt: out.prompt,
    choices: [out.answer, out.wrong[0], out.wrong[1], out.wrong[2]], explanation: out.explain,
  };
}

/** A fresh generated math question for a grade (optionally a specific skill), or undefined if none exists. */
export function generateMath(grade: number, skill?: string, rng: Rng = Math.random): BankItem | undefined {
  const options = GENS.filter(g => g.grade === grade && (!skill || g.skill === skill));
  if (!options.length) return undefined;
  for (let tries = 0; tries < 5; tries++) {
    const g = options[Math.floor(rng() * options.length)];
    const it = generatedItem(`gen:math:${g.id}:${Math.floor(rng() * 2 ** 31)}`);
    if (it) return it;
  }
  return undefined;
}
