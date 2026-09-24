import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DISCOVA — Get your business website audited today",
  description:
    "One scan. A real Visibility Score, live Google measurements, and a report you keep. Powered by lean.X digital.",
};

const PROOF = [
  "160-check professional framework",
  "Live Google measurements",
  "Design reviewed",
  "A report you keep",
];

const CARDS = [
  {
    title: "One honest score",
    body: "60% is what your website is. 40% is whether Google actually shows it. No vanity numbers — a site nobody can find cannot score well here.",
  },
  {
    title: "Google, today",
    body: "How many of your pages Google lists, whether you appear for your own name, and whether you appear for the searches customers actually type. Measured live, never guessed.",
  },
  {
    title: "A verdict, not a maybe",
    body: "Every audit names the reason behind the number — “Too new for Google”, “Findable by name only”, “Visible but outgunned” — and what it is costing you.",
  },
];

export default function Landing() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between gap-2 flex-wrap pb-8">
          <span className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/discova-logo.png" alt="DISCOVA" className="h-8 w-auto" />
            <span className="hidden min-[400px]:block text-[10px] tracking-[.14em] uppercase text-[var(--muted)] pt-1.5">
              powered by lean.X digital
            </span>
          </span>
          <Link
            href="/dashboard"
            className="text-[11px] text-[var(--faint)] underline underline-offset-2 hover:text-[var(--ink)]"
          >
            team sign in
          </Link>
        </header>

        {/* Hero */}
        <div className="border-t-2 border-[var(--ink)] bg-[var(--paper)]">
          <section className="px-5 sm:px-10 pt-10 sm:pt-16 pb-10 sm:pb-14">
            <h1 className="serif text-4xl sm:text-6xl leading-[1.04] text-[var(--ink)]">
              Get your business website{" "}
              <span className="bg-[var(--neon,#A8E60A)] px-2 -mx-1 whitespace-nowrap">audited today.</span>
            </h1>
            <p className="mt-5 sm:mt-6 text-[16px] sm:text-[18px] leading-relaxed text-[var(--body)] max-w-xl">
              Walk away with a real report of your visibility on Google — what
              customers can find, what they can&rsquo;t, and what that is
              quietly costing you.
            </p>

            <div className="mt-8 sm:mt-10">
              <Link
                href="/dashboard"
                className="inline-block bg-[var(--accent)] text-white text-[17px] px-8 py-4 w-full sm:w-auto text-center"
              >
                Audit my business now
              </Link>
              <p className="mt-3 text-[12px] text-[var(--faint)]">
                Takes about two minutes. Every claim in the report is backed by
                evidence you can check yourself.
              </p>
            </div>

            {/* Proof strip */}
            <div className="mt-10 flex flex-wrap gap-1.5">
              {PROOF.map((p) => (
                <span
                  key={p}
                  className="text-[9px] font-mono uppercase tracking-wide px-2 py-1 rounded border border-[var(--hair)] text-[var(--muted)]"
                >
                  {p}
                </span>
              ))}
            </div>
          </section>

          {/* What you get */}
          <section className="border-t border-[var(--hair)] px-5 sm:px-10 py-8 sm:py-10">
            <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-5">
              What the audit tells you
            </p>
            <div className="grid gap-5 sm:grid-cols-3">
              {CARDS.map((c) => (
                <div key={c.title} className="border-l-2 border-[var(--fill)] pl-4">
                  <h2 className="serif text-[17px] text-[var(--ink)]">{c.title}</h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">{c.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Closing CTA */}
          <section className="border-t border-[var(--hair)] px-5 sm:px-10 py-8 sm:py-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <p className="serif text-[19px] sm:text-[21px] text-[var(--ink)] max-w-md leading-snug">
              If your website is invisible, this report will say so — and show
              you exactly why.
            </p>
            <Link
              href="/dashboard"
              className="bg-[var(--accent)] text-white text-[15px] px-7 py-3.5 text-center shrink-0"
            >
              Audit my business now
            </Link>
          </section>
        </div>

        <footer className="pt-5 text-[10px] tracking-[.12em] uppercase text-[var(--faint)] flex justify-between flex-wrap gap-2">
          <span>DISCOVA · powered by lean.X digital</span>
          <span>© {new Date().getFullYear()} lean.X digital</span>
        </footer>
      </div>
    </main>
  );
}
