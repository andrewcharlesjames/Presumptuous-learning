import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireSchoolUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/Shell";
import { Info } from "@/components/Info";
import { Mark } from "@/components/Logo";
import { appUrl } from "@/lib/email";
import { gradeName } from "@/lib/subjects";
import { PrintButton } from "@/app/invoices/[id]/PrintButton";
import { makeCards, replaceCard } from "../../cards-actions";

export const metadata = { title: "Sign-in cards" };

export default async function CardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, school } = await requireSchoolUser(["COACH", "SCHOOL_ADMIN"]);
  const cls = await db.class.findFirst({
    where: { id, schoolId: school.id, ...(user.role === "COACH" ? { coaches: { some: { coachId: user.id } } } : {}) },
    include: { students: { include: { student: true }, orderBy: { student: { lastName: "asc" } } } },
  });
  if (!cls) notFound();
  const students = cls.students.map(s => s.student).filter(s => s.active);
  const missing = students.filter(s => !s.cardToken).length;
  const cards = await Promise.all(students.filter(s => s.cardToken).map(async s => ({
    s, svg: await QRCode.toString(`${appUrl()}/card/${s.cardToken}`, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }),
  })));
  return (
    <Shell user={user}>
      <div className="spread noprint">
        <div><Link href={`/coach/classes/${cls.id}`} className="small">← {cls.name}</Link>
          <h1>Sign-in cards<Info label="Sign-in cards">{"Each card has a QR code that signs that student straight in: they point a tablet or phone camera at it. Great for younger students. A card works like a password, so keep cards in the classroom. If one is lost, click Replace card: the old one stops working at once. Students can still sign in with school code, username and password."}</Info></h1></div>
        <PrintButton />
      </div>
      {missing > 0 && (
        <form action={makeCards} className="card noprint">
          <input type="hidden" name="classId" value={cls.id} />
          <p>{missing} student{missing === 1 ? " doesn't" : "s don't"} have a card yet.</p>
          <div><button className="btn primary">Make {missing === 1 ? "their card" : `${missing} cards`}</button></div>
        </form>
      )}
      {cards.length === 0 ? <div className="empty noprint"><b>No cards yet</b><span>Make cards above, then print them on card stock and cut along the lines.</span></div> : (
        <div className="cards">
          {cards.map(({ s, svg }) => (
            <div key={s.id} className="signcard">
              <div className="row" style={{ gap: 8 }}><Mark size={22} /><b className="small">presumptuous learning</b></div>
              <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`Sign-in QR code for ${s.firstName} ${s.lastName}`} />
              <div><b style={{ fontSize: "1.1rem" }}>{s.firstName} {s.lastName}</b><br /><span className="small muted">{gradeName(s.grade ?? 0)} · {cls.name}</span></div>
              <div className="small">Scan to sign in, or type:<br />School code <b className="num">{school.code}</b> · Username <b className="num">{s.username}</b></div>
              <form action={replaceCard} className="noprint"><input type="hidden" name="classId" value={cls.id} /><input type="hidden" name="studentId" value={s.id} /><button className="btn small">Replace card</button></form>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
