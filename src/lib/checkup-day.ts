/** From a month's school days (ISO dates): the last Friday, or the last school day if no Friday is a school day. */
export function pickCheckupDay(days: string[]): string | null {
  const sorted = [...days].sort();
  if (!sorted.length) return null;
  const fridays = sorted.filter(d => new Date(`${d}T00:00:00Z`).getUTCDay() === 5);
  return fridays.at(-1) ?? sorted.at(-1)!;
}
