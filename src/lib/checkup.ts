import "server-only";
import type { School } from "@prisma/client";
import { utcDate, isoDate } from "./dates";
import { schoolDays } from "./schoolday";
import { pickCheckupDay } from "./checkup-day";

/**
 * The monthly check-up: the last Friday of the month that's a school day
 * (or, if every Friday is off, the month's last school day).
 */
export async function checkupDay(school: Pick<School, "id" | "yearStart" | "yearEnd">, year: number, month: number): Promise<string | null> {
  const first = utcDate(year, month, 1), last = utcDate(year, month + 1, 0);
  return pickCheckupDay([...(await schoolDays(school, first, last))]);
}

/** The check-up date in a week (Monday to Friday), if one falls in it. */
export async function checkupInWeek(school: Pick<School, "id" | "yearStart" | "yearEnd">, monday: Date): Promise<string | null> {
  const friday = new Date(monday.getTime() + 4 * 86400000);
  for (const d of new Set([`${monday.getUTCFullYear()}-${monday.getUTCMonth()}`, `${friday.getUTCFullYear()}-${friday.getUTCMonth()}`])) {
    const [y, m] = d.split("-").map(Number);
    const day = await checkupDay(school, y, m);
    if (day && day >= isoDate(monday) && day <= isoDate(friday)) return day;
  }
  return null;
}
