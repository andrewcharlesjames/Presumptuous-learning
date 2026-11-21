import { requireSchoolUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { WeekView } from "@/components/WeekView";

export const metadata = { title: "My week" };

export default async function MyWeek({ searchParams }: { searchParams: Promise<{ view?: string; m?: string }> }) {
  const { user, school } = await requireSchoolUser(["STUDENT"]);
  const sp = await searchParams;
  return (
    <Shell user={user}>
      <WeekView student={user} school={school} base="/student/week" self view={sp.view === "month" ? "month" : "week"} month={sp.m} />
    </Shell>
  );
}
