import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_COLOR: Record<string, string> = {
  critical: "var(--attn)", high: "var(--attn)", medium: "var(--improve)", low: "var(--muted)",
};
const STATUS_COLOR: Record<string, string> = {
  "Needs attention": "var(--attn)", "Needs improvement": "var(--improve)",
  Fair: "var(--accent)", Good: "var(--good)",
};
const BANDS = ["Critical", "Developing", "Fair", "Good", "Excellent"];
const BAND_COLOR: Record<string, string> = {
  Critical: "var(--attn)", Developing: "var(--improve)", Fair: "var(--accent)",
  Good: "var(--good)", Excellent: "var(--good)",
};

type Area = { key: string; label: string; score: number; status: string; note: string };
type Sub = { area: string; points: number; max: number; note: string };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = db();
  if (!client) return <p className="p-10 text-sm">Database not connected.</p>;

  const [{ data: run }, { data: findings }] = await Promise.all([
    client.from("runs").select("*").eq("id", id).maybeSingle(),
    client.from("findings").select("*").eq("run_id", id),
  ]);
  if (!run) notFound();

  const running = !["done", "failed"].includes(run.status);
  const s = run.scores ?? {};
  const areas: Area[] = s.areas ?? [];
  const subs: Sub[] = s.design_subscores ?? [];
  const gap = s.clearest_gap;
  const strengths: string[] = s.strengths ?? [];
  const sorted = (findings ?? []).sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || a.score_impact - b.score_impact
  );
  const gapMax = gap ? Math.max(gap.value_a, gap.value_b, 1) : 1;

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-baseline justify-between pb-3">
          <span className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)]">
            <Link href="/" className="text-[var(--ink)] font-semibold hover:underline">DISCOVA</Link>
            <span className="mx-1.5 text-[var(--rule)]">·</span>powered by lean.X digital
          </span>
          <span className="text-[11px] text-[var(--faint)]">
            {run.tier} · framework v{run.framework_version} ·{" "}
            {new Date(run.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </header>

        <div className="border-t-2 border-[var(--ink)] bg-[var(--paper)]">
          {/* In-progress banner */}
          {running && (
            <div className="px-8 py-5 border-b border-[var(--hair)] flex items-baseline justify-between">
              <span className="text-sm text-[var(--accent)]">
                Analysing {run.domain} — {run.status}…
              </span>
              <span className="text-xs text-[var(--faint)]">this page refreshes itself</span>
              <script dangerouslySetInnerHTML={{ __html: "setTimeout(()=>location.reload(),4000)" }} />
            </div>
          )}
          {run.status === "failed" && (
            <div className="px-8 py-5 border-b border-[var(--hair)]">
              <span className="text-sm text-[var(--attn)]">
                This run failed{s.error ? `: ${s.error}` : "."}
              </span>
            </div>
          )}

          {/* Title + overall */}
          <div className="px-8 pt-8 pb-7 border-b border-[var(--hair)]">
            <div className="flex items-baseline justify-between gap-4">
              <h1 className="serif text-3xl text-[var(--ink)]">{run.domain}</h1>
              {run.status === "done" && (
                <a href={`/api/run/${run.id}/pdf`} target="_blank"
                  className="shrink-0 text-sm text-[var(--accent)] border border-[var(--accent)] px-4 py-1.5 hover:bg-[var(--accent)] hover:text-white transition-colors">
                  Client PDF
                </a>
              )}
            </div>
            {run.status === "done" && s.narrative?.lead && (
              <p className="serif italic text-[17px] text-[var(--ink)] mt-3 max-w-xl">{s.narrative.lead}</p>
            )}
            {run.status === "done" && (
              <div className="mt-6 flex items-start gap-8 flex-wrap">
                <div>
                  <span className="serif text-6xl text-[var(--ink)] leading-none">{s.overall ?? "—"}</span>
                  <span className="serif text-lg text-[var(--muted)]">/100</span>
                  <p className="mt-1.5 text-[10px] tracking-[.14em] uppercase text-[var(--muted)]">Overall health</p>
                </div>
                <div className="flex-1 min-w-56 pt-1.5">
                  <div className="flex gap-0.5 h-3">
                    {BANDS.map((b) => (
                      <span key={b} className="flex-1"
                        style={{ background: b === s.band ? BAND_COLOR[b] : "var(--track)" }} />
                    ))}
                  </div>
                  <div className="flex mt-1.5">
                    {BANDS.map((b) => (
                      <span key={b} className="flex-1 text-center text-[9px] tracking-[.05em] uppercase"
                        style={{ color: b === s.band ? BAND_COLOR[b] : "var(--faint)", fontWeight: b === s.band ? 600 : 400 }}>
                        {b}
                      </span>
                    ))}
                  </div>
                  {s.design_pending && (
                    <p className="mt-2 text-[11px] text-[var(--faint)]">
                      Design &amp; Brand and Authority pending their integrations — their weight is redistributed. {s.coverage_note}.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Areas */}
          {areas.length > 0 && (
            <section className="px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-4">Where it stands</p>
              {areas.map((a, i) => (
                <div key={a.key} className={`py-2.5 ${i > 0 ? "border-t border-[var(--hair)]" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="serif text-[15px] text-[var(--ink)] w-44 shrink-0">{a.label}</span>
                    <span className="flex-1 h-2.5 bg-[var(--track)]">
                      <span className="block h-full bg-[var(--fill)]" style={{ width: `${a.score}%` }} />
                    </span>
                    <span className="w-8 text-right text-sm text-[var(--ink)] tabular-nums">{a.score}</span>
                  </div>
                  <p className="mt-1 text-[13px]">
                    <span style={{ color: STATUS_COLOR[a.status] ?? "var(--muted)" }} className="serif">{a.status}</span>
                    <span className="text-[var(--muted)]"> — {a.note}</span>
                  </p>
                </div>
              ))}
            </section>
          )}

          {/* Design sub-scores (fixture-era runs only, until stage 5) */}
          {subs.length > 0 && (
            <section className="px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-4">
                Design review — {s.design_total?.points}/{s.design_total?.max} criteria met
              </p>
              {subs.map((d, i) => (
                <div key={d.area} className={`flex items-center gap-3 py-2 ${i > 0 ? "border-t border-[var(--hair)]" : ""}`}>
                  <span className="serif text-[14px] text-[var(--ink)] w-44 shrink-0">{d.area}</span>
                  <span className="w-28 h-2 bg-[var(--track)] shrink-0">
                    <span className="block h-full bg-[var(--fill)]" style={{ width: `${(d.points / d.max) * 100}%` }} />
                  </span>
                  <span className="w-10 text-sm text-[var(--ink)] tabular-nums shrink-0">{d.points}/{d.max}</span>
                  <span className="text-[13px] text-[var(--muted)] flex-1">{d.note}</span>
                </div>
              ))}
            </section>
          )}

          {/* Clearest gap */}
          {gap && (
            <section className="px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-4">The clearest gap</p>
              {[["label_a", "sub_a", "value_a", "var(--fill)"], ["label_b", "sub_b", "value_b", "var(--attn)"]].map(
                ([l, sub, v, color]) => (
                  <div key={l} className="flex items-center gap-3 py-1.5">
                    <span className="w-56 shrink-0 text-[13px]">
                      <span className="text-[var(--ink)] font-semibold">{gap[l]}</span>
                      <br /><span className="text-[var(--muted)]">{gap[sub]}</span>
                    </span>
                    <span className="flex-1 h-3.5 bg-[var(--track)]">
                      <span className="block h-full" style={{ width: `${Math.max((gap[v] / gapMax) * 100, 1.5)}%`, background: color }} />
                    </span>
                    <span className="serif text-lg text-[var(--ink)] w-10 text-right tabular-nums">{gap[v]}</span>
                  </div>
                )
              )}
              <p className="mt-3 text-[13px] text-[var(--muted)]">{gap.note}</p>
            </section>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <section className="px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-3">What is working</p>
              <ul className="space-y-1.5">
                {strengths.map((t) => (
                  <li key={t} className="text-[13px] flex gap-2">
                    <span style={{ color: "var(--good)" }}>✓</span><span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Findings */}
          {sorted.length > 0 && (
            <section className="px-8 py-7">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-2">
                Findings — {sorted.length}
              </p>
              {sorted.map((f) => (
                <details key={f.id} className="border-t border-[var(--hair)] first:border-t-0 group">
                  <summary className="py-3.5 flex items-baseline gap-3 cursor-pointer list-none hover:bg-[var(--ground)] -mx-3 px-3">
                    <span className="serif text-[13px] w-16 shrink-0" style={{ color: SEV_COLOR[f.severity] }}>
                      {f.severity}
                    </span>
                    <span className="text-[var(--ink)] text-[15px] flex-1">{f.title}</span>
                    <span className="text-[10px] text-[var(--faint)] uppercase tracking-wide shrink-0">
                      {f.evidence_label.replaceAll("_", " ")}
                    </span>
                    <span className="text-[var(--faint)] text-xs group-open:rotate-90 transition-transform">›</span>
                  </summary>
                  <div className="pb-5 pl-[76px] pr-4 space-y-3 text-[13px]">
                    {f.evidence && (
                      <p className="font-mono text-[12px] bg-[var(--ground)] px-3 py-2 whitespace-pre-wrap">{f.evidence}</p>
                    )}
                    {f.internal_detail && (
                      <p><span className="text-[10px] tracking-[.1em] uppercase text-[var(--muted)] block mb-0.5">Internal fix — never client-facing</span>{f.internal_detail}</p>
                    )}
                    {f.client_summary && (
                      <p><span className="text-[10px] tracking-[.1em] uppercase text-[var(--accent)] block mb-0.5">Client wording</span>{f.client_summary}</p>
                    )}
                    <p className="text-[11px] text-[var(--faint)]">
                      {f.check_id} · {f.category} · verified via {f.verification ?? "—"} · confidence {f.confidence} ·
                      reach {f.reach ?? "—"} · effort {f.effort?.replaceAll("_", " ") ?? "—"} · score impact {f.score_impact}
                    </p>
                  </div>
                </details>
              ))}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
