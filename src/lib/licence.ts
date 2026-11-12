// Licences and invoices: per-student annual pricing with Ontario HST.
import { addDays } from "./dates.ts";

export const HST_RATE = 0.13;
export const PILOT_DAYS = 90;

export const students = (n: number) => `${n} student${n === 1 ? "" : "s"}`;

export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });

/** Invoice amounts in cents: subtotal = seats × unit price; HST 13% rounded to the cent. */
export function invoiceTotals(seats: number, unitPriceCents: number) {
  const subtotalCents = Math.max(0, Math.round(seats)) * Math.max(0, Math.round(unitPriceCents));
  const taxCents = Math.round(subtotalCents * HST_RATE);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export type LicenceState = { label: string; tone: "above" | "at" | "below" | "none"; daysLeft: number | null; warn: string | null };

/** `viewer` "admin" words the warning for Presumptuous Learning staff rather than the school. */
export function licenceState(s: { plan: string; seats: number; licenceEnd: Date | null }, today: Date, studentsUsed: number, viewer: "school" | "admin" = "school"): LicenceState {
  const daysLeft = s.licenceEnd ? Math.round((s.licenceEnd.getTime() - today.getTime()) / 86400000) : null;
  const plan = s.plan === "ACTIVE" ? "Active licence" : "Pilot";
  const [your, you] = viewer === "admin" ? ["The school's", "The school has"] : ["Your", "You have"];
  let warn: string | null = null;
  if (daysLeft !== null && daysLeft < 0) warn = `${your} ${plan.toLowerCase()} ended ${-daysLeft} day${daysLeft === -1 ? "" : "s"} ago.${viewer === "school" ? " Contact Presumptuous Learning to renew." : ""}`;
  else if (daysLeft !== null && daysLeft <= 30) warn = `${your} ${plan.toLowerCase()} ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`;
  if (studentsUsed > s.seats) warn = `${warn ? warn + " " : ""}${you} ${students(studentsUsed)} but ${viewer === "admin" ? "its" : "your"} licence covers ${s.seats}.`;
  const tone = daysLeft !== null && daysLeft < 0 ? "below" : warn ? "at" : s.plan === "ACTIVE" ? "above" : "none";
  return { label: plan, tone, daysLeft, warn };
}

export function pilotEnd(today: Date) {
  return addDays(today, PILOT_DAYS);
}
