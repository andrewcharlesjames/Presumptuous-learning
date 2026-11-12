import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Privacy notice" };

/** Plain-language privacy notice. A draft: review with a lawyer before schools rely on it. */
export default function PrivacyNotice() {
  return (
    <div className="wrap">
      <header className="topbar"><Logo /><Link className="btn" href="/login">Sign in</Link></header>
      <main className="stack-lg" style={{ maxWidth: 760 }}>
        <div className="flash error"><span>Draft for legal review. This notice describes how the platform works today. Have it reviewed by a lawyer familiar with Ontario and Canadian privacy law before schools rely on it.</span></div>
        <div><span className="eyebrow">Presumptuous Learning</span><h1>Privacy notice</h1></div>

        <section className="stack"><h2>Who is responsible</h2>
          <p>Each school that uses Presumptuous Learning decides who uses it and what it&apos;s used for, and is responsible for its students&apos; records. Presumptuous Learning stores and processes those records on the school&apos;s behalf. Questions about a student&apos;s records go to the school first.</p></section>

        <section className="stack"><h2>What we store</h2>
          <ul>
            <li><b>Accounts:</b> names, grade, school username, and email addresses for adults. Passwords are stored only in scrambled (hashed) form.</li>
            <li><b>Learning records:</b> assessment answers and results, learning plans, lessons taken, practice and mastery checks, skills mastered.</li>
            <li><b>The school day:</b> daily check-ins (mood and goal), reflections, attendance, assignments, and notes written by coaches.</li>
            <li><b>Student work:</b> photos, recordings, videos and writing handed in to the portfolio, and project proposals and milestones.</li>
            <li><b>Activity records:</b> who viewed or changed a student&apos;s records and when (the audit log).</li>
          </ul></section>

        <section className="stack"><h2>Who can see it</h2>
          <ul>
            <li><b>The student</b> sees their own records.</li>
            <li><b>Parents</b> linked with the school&apos;s family code see their own children&apos;s records, and only notes a coach chose to share.</li>
            <li><b>Coaches</b> see students in their classes. <b>School admins</b> see all students in their school.</li>
            <li>No one at one school can see another school&apos;s records. The Launch Day showcase shows approved project titles with a first name and last initial, only to people at the same school.</li>
          </ul></section>

        <section className="stack"><h2>AI features</h2>
          <p>Some features use Claude, an AI service made by Anthropic:</p>
          <ul>
            <li><b>Lessons and practice questions</b> are written from the skill and grade only. No student information is sent.</li>
            <li><b>The AI tutor</b> sends the practice question, its answer choices, the student&apos;s choice and their grade.</li>
            <li><b>Project ideas</b> send the student&apos;s answers to the discovery questions and their grade. Students are asked not to include names or addresses.</li>
          </ul>
          <p>Student names, usernames and email addresses are never sent to the AI service. Schools can require a parent&apos;s consent before a student uses the AI tutor or project ideas.</p></section>

        <section className="stack"><h2>Where it&apos;s stored</h2>
          <p>Records are stored in a database hosted by Railway. AI requests are processed by Anthropic. Both currently process data in the United States. Schools that need data kept in Canada should raise this before signing up.</p></section>

        <section className="stack"><h2>How long we keep it</h2>
          <p>Records are kept while the student is enrolled with their school, unless the school deletes them sooner. When a school deletes a student, their account, records and files are removed permanently. The audit log keeps a record that the deletion happened.</p></section>

        <section className="stack"><h2>Your choices</h2>
          <ul>
            <li><b>Consent:</b> parents can give or withdraw consent for platform use and for AI features from their dashboard, at any time.</li>
            <li><b>A copy of the data:</b> parents and school admins can download everything stored about a student.</li>
            <li><b>Deletion:</b> parents can ask the school to delete their child&apos;s data from their dashboard. The school confirms and carries it out.</li>
            <li><b>Corrections:</b> ask the school to correct anything that&apos;s wrong.</li>
          </ul></section>

        <section className="stack"><h2>Security</h2>
          <p>Connections are encrypted. Passwords are hashed. Sign-in attempts are limited. Uploaded files are checked and only shown to people allowed to see that student. Every view of a student&apos;s records by staff or parents is logged.</p></section>

        <section className="stack"><h2>Contact</h2>
          <p>Contact your child&apos;s school first. To reach Presumptuous Learning: [contact email to be added].</p></section>
      </main>
    </div>
  );
}
