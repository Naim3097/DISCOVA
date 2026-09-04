import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AutoRefresh } from "@/app/refresh";

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

  const running = !["done", "failed", "partial"].includes(run.status);
  const settled = ["done", "partial"].includes(run.status);
  const s = run.scores ?? {};
  const areas: Area[] = s.areas ?? [];
  const subs: Sub[] = s.design_subscores ?? [];
  const gap = s.clearest_gap;
  const strengths: string[] = s.strengths ?? [];
  const bySeverity = (a: any, b: any) =>
    (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || a.score_impact - b.score_impact;
  const isInv = (f: any) => String(f.check_id ?? "").startsWith("inv-");
  const sorted = (findings ?? []).filter((f) => !isInv(f)).sort(bySeverity);
  const invSorted = (findings ?? []).filter(isInv).sort(bySeverity);
  const inv = s.investigation;
  const gapMax = gap ? Math.max(gap.value_a, gap.value_b, 1) : 1;

  const findingRow = (f: any) => (
    <details key={f.id} className="group border border-[var(--hair)] rounded-lg mb-2.5 overflow-hidden open:border-[var(--rule)]">
      <summary className="px-4 py-3 flex items-center gap-3 cursor-pointer list-none hover:bg-[var(--ground)] group-open:bg-[var(--ground)]">
        <span className="w-14 shrink-0 text-[11px] font-semibold" style={{ color: SEV_COLOR[f.severity] }}>
          {f.severity}
        </span>
        <span className="text-[var(--ink)] text-[14px] leading-snug flex-1">{f.title}</span>
        <span className="text-[9px] text-[var(--faint)] uppercase tracking-wide shrink-0">
          {f.evidence_label.replaceAll("_", " ")}
        </span>
        <span className="text-[var(--faint)] text-xs group-open:rotate-90 transition-transform">›</span>
      </summary>
      <div className="px-4 pb-4 pt-3 pl-4 sm:pl-[68px] space-y-3.5 text-[13px] border-t border-[var(--hair)]">
        {f.evidence && (
          <p className="font-mono text-[11.5px] leading-relaxed text-[var(--muted)] bg-[var(--ground)] px-3 py-2.5 rounded-md whitespace-pre-wrap break-words max-h-36 overflow-y-auto">
            {f.evidence}
          </p>
        )}
        {f.internal_detail && (
          <div className="border-l-2 border-[var(--rule)] pl-3">
            <p className="text-[9px] tracking-[.12em] uppercase text-[var(--faint)] mb-1">Internal fix · never client-facing</p>
            <p className="leading-relaxed">{f.internal_detail}</p>
          </div>
        )}
        {f.client_summary && (
          <div className="border-l-2 border-[var(--fill)] pl-3">
            <p className="text-[9px] tracking-[.12em] uppercase text-[var(--faint)] mb-1">Client wording</p>
            <p className="leading-relaxed text-[var(--ink)]">{f.client_summary}</p>
          </div>
        )}
        <p className="text-[10px] text-[var(--faint)] font-mono">
          {f.check_id} · effort {f.effort?.replaceAll("_", " ") ?? "—"} · reach {f.reach ?? "—"}
        </p>
      </div>
    </details>
  );

  return (
    <main className="min-h-screen px-3 py-5 sm:px-6 sm:py-10">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between gap-2 flex-wrap pb-4">
          <span className="flex items-center gap-3">
            <Link href="/" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/discova-logo.png" alt="DISCOVA" className="h-8 w-auto" />
            </Link>
            <span className="text-[10px] tracking-[.14em] uppercase text-[var(--muted)] pt-1.5">
              powered by lean.X digital
            </span>
          </span>
          <span className="hidden sm:block text-[11px] text-[var(--faint)]">
            {run.tier} · framework v{run.framework_version} ·{" "}
            {new Date(run.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </header>

        <div className="border-t-2 border-[var(--ink)] bg-[var(--paper)]">
          {/* In-progress banner */}
          {running && (
            <div className="px-4 sm:px-8 py-5 border-b border-[var(--hair)] flex items-baseline justify-between">
              <span className="text-sm text-[var(--accent)]">
                Analysing {run.domain} — {run.status}…
              </span>
              <span className="text-xs text-[var(--faint)]">updating live</span>
              <AutoRefresh />
            </div>
          )}
          {run.status === "partial" && (
            <div className="px-4 sm:px-8 py-5 border-b border-[var(--hair)]">
              <span className="text-sm text-[var(--improve)]">
                Partial run — {s.partial_note ?? "some checks could not be completed"}. The score reflects the checks that ran.
              </span>
            </div>
          )}
          {run.status === "failed" && (
            <div className="px-4 sm:px-8 py-5 border-b border-[var(--hair)]">
              <span className="text-sm text-[var(--attn)]">
                This run failed{s.error ? `: ${s.error}` : "."}
              </span>
            </div>
          )}

          {/* Title + overall */}
          <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-7 border-b border-[var(--hair)]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h1 className="serif text-2xl sm:text-3xl text-[var(--ink)] break-all">{run.domain}</h1>
              {settled && (
                <a href={`/api/run/${run.id}/pdf`} download
                  className="w-full sm:w-auto text-center shrink-0 text-sm text-[var(--accent)] border border-[var(--accent)] px-4 py-2 hover:bg-[var(--accent)] hover:text-white transition-colors">
                  Download client PDF
                </a>
              )}
            </div>
            {settled && s.narrative?.lead && (
              <p className="serif italic text-[17px] text-[var(--ink)] mt-3 max-w-xl">{s.narrative.lead}</p>
            )}
            {settled && s.diagnosis && s.diagnosis.code !== "pending" && (
              <p className="mt-3 text-[13px]">
                <span className="font-semibold px-2 py-0.5 rounded border border-[var(--rule)] mr-2"
                  style={{ color: s.diagnosis.code === "visible" ? "var(--good)" : "var(--attn)" }}>
                  {s.diagnosis.label}
                </span>
                <span className="text-[var(--muted)]">{s.diagnosis.detail}</span>
              </p>
            )}
            {settled && (
              <div className="mt-6 flex items-start gap-8 flex-wrap">
                <div>
                  <span className="serif text-6xl text-[var(--ink)] leading-none">{s.overall ?? "—"}</span>
                  <span className="serif text-lg text-[var(--muted)]">/100</span>
                  <p className="mt-1.5 text-[10px] tracking-[.14em] uppercase text-[var(--muted)]">Visibility score</p>
                  {s.presence != null && (
                    <p className="mt-1 text-[11px] text-[var(--muted)] tabular-nums">
                      readiness {s.readiness} <span className="text-[var(--faint)]">×60%</span> + presence {s.presence} <span className="text-[var(--faint)]">×40%</span>
                    </p>
                  )}
                  {s.score_note && (
                    <p className="mt-1 text-[11px] text-[var(--faint)] max-w-40">{s.score_note}</p>
                  )}
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
                      Design &amp; Brand and Authority pending their integrations — their weight is redistributed.
                    </p>
                  )}
                  {s.coverage_note && (
                    <p className="mt-2 text-[11px] text-[var(--faint)]">{s.coverage_note}.</p>
                  )}
                  {s.google_reality && !s.google_reality.pending && !s.google_reality.error && (
                    <div className="mt-3 pt-2 border-t border-[var(--hair)]">
                      <p className="text-[10px] tracking-[.12em] uppercase text-[var(--muted)] mb-1">Google today</p>
                      <p className="text-[12px] flex flex-wrap gap-x-3 gap-y-0.5">
                        <span style={{ color: s.google_reality.indexed_pages === 0 ? "var(--attn)" : "var(--good)" }}>
                          {s.google_reality.indexed_pages === 0
                            ? "no pages in Google's index"
                            : `${s.google_reality.indexed_at_least ? "10+" : s.google_reality.indexed_pages} pages indexed`}
                        </span>
                        {s.google_reality.brand_found === false && (
                          <span className="text-[var(--attn)]">not found for its own name</span>
                        )}
                        {s.google_reality.brand_position != null && (
                          <span className="text-[var(--good)]">#{s.google_reality.brand_position} for its own name</span>
                        )}
                        {s.google_reality.domain_age_days != null && (
                          <span style={{ color: s.google_reality.domain_age_days < 180 ? "var(--improve)" : "var(--muted)" }}>
                            domain {s.google_reality.domain_age_days < 90
                              ? `${s.google_reality.domain_age_days} days old`
                              : s.google_reality.domain_age_days < 730
                                ? `${Math.round(s.google_reality.domain_age_days / 30)} months old`
                                : `${Math.floor(s.google_reality.domain_age_days / 365)} years old`}
                          </span>
                        )}
                      </p>
                      {Array.isArray(s.funnel) && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {s.funnel.map((st: any) => (
                            <span key={st.key}
                              className="text-[9px] font-mono uppercase tracking-wide px-2 py-1 rounded border"
                              style={{
                                borderColor: "var(--hair)",
                                color: st.state === "pass" ? "var(--good)" : st.state === "fail" ? "var(--attn)" : "var(--faint)",
                              }}>
                              {st.state === "pass" ? "✓" : st.state === "fail" ? "✗" : "?"} {st.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {Array.isArray(s.google_reality.service_queries) && s.google_reality.service_queries.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] tracking-[.12em] uppercase text-[var(--muted)] mb-1">Customer searches tested</p>
                          {s.google_reality.service_queries.map((sq: any) => (
                            <p key={sq.q} className="text-[12px] flex justify-between gap-3 py-0.5">
                              <span className="text-[var(--ink)] truncate">&ldquo;{sq.q}&rdquo;</span>
                              <span className="shrink-0 tabular-nums"
                                style={{ color: sq.position != null ? "var(--good)" : "var(--attn)" }}>
                                {sq.position != null ? `#${sq.position}` : "not in top 10"}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {s.google_reality?.pending && (
                    <p className="mt-2 text-[11px] text-[var(--faint)]">
                      {s.google_reality.note}
                      {s.google_reality.domain_age_days != null ? ` · domain registered ${s.google_reality.domain_registered}` : ""}.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Areas */}
          {areas.length > 0 && (
            <section className="px-4 sm:px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-4">Where it stands</p>
              {areas.map((a, i) => (
                <div key={a.key} className={`py-2.5 ${i > 0 ? "border-t border-[var(--hair)]" : ""}`}>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex items-baseline justify-between sm:contents">
                    <span className="serif text-[15px] text-[var(--ink)] sm:w-44 sm:shrink-0">{a.label}</span>
                    
                    <span className="text-sm text-[var(--ink)] tabular-nums sm:order-last sm:w-8 sm:text-right">{a.score}</span>
                    </div>
                    <span className="w-full h-2.5 bg-[var(--track)] sm:flex-1">
                      <span className="block h-full bg-[var(--fill)]" style={{ width: `${a.score}%` }} />
                    </span>
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
            <section className="px-4 sm:px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-4">
                Design review — {s.design_total?.points}/{s.design_total?.max} criteria met
              </p>
              {subs.map((d, i) => (
                <div key={d.area} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2 ${i > 0 ? "border-t border-[var(--hair)]" : ""}`}>
                  <span className="serif text-[14px] text-[var(--ink)] w-full sm:w-44 sm:shrink-0">{d.area}</span>
                  <span className="w-28 h-2 bg-[var(--track)] shrink-0">
                    <span className="block h-full bg-[var(--fill)]" style={{ width: `${(d.points / d.max) * 100}%` }} />
                  </span>
                  <span className="w-10 text-sm text-[var(--ink)] tabular-nums shrink-0">{d.points}/{d.max}</span>
                  <span className="text-[13px] text-[var(--muted)] basis-full sm:basis-0 sm:flex-1">{d.note}</span>
                </div>
              ))}
            </section>
          )}

          {/* Clearest gap */}
          {gap && (
            <section className="px-4 sm:px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-4">The clearest gap</p>
              {[["label_a", "sub_a", "value_a", "var(--fill)"], ["label_b", "sub_b", "value_b", "var(--attn)"]].map(
                ([l, sub, v, color]) => (
                  <div key={l} className="flex items-center gap-3 py-1.5">
                    <span className="w-32 sm:w-56 shrink-0 text-[13px]">
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
            <section className="px-4 sm:px-8 py-7 border-b border-[var(--hair)]">
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

          {/* Site-wide survey (Investigation tier) */}
          {inv && (
            <section className="px-4 sm:px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-3">Site-wide survey</p>
              {inv.error ? (
                <p className="text-sm text-[var(--attn)]">{inv.error}</p>
              ) : (
                <>
                  <p className="text-[13px] text-[var(--muted)]">
                    {inv.pages_fetched} pages fetched of {inv.pages_known} discovered ·{" "}
                    {inv.templates?.length ?? 0} page templates shown
                    {inv.sampled_out > 0 && <> · {inv.sampled_out} URLs sampled out (max {inv.caps?.per_template} per template)</>}
                    {inv.cap_hit && <> · fetch cap of {inv.caps?.max_fetch} reached</>}
                    {inv.deadline_hit && <> · time cap reached</>} · {inv.duration_s}s
                  </p>
                  {(inv.templates ?? []).length > 0 && (
                    <div className="mt-4">
                      {(inv.templates as { template: string; known: number; fetched: number }[]).map((t, i) => (
                        <div key={t.template} className={`flex items-center gap-3 py-1.5 ${i > 0 ? "border-t border-[var(--hair)]" : ""}`}>
                          <span className="font-mono text-[12px] text-[var(--ink)] flex-1 truncate">{t.template}</span>
                          <span className="text-[12px] text-[var(--muted)] shrink-0 tabular-nums">{t.known} known</span>
                          <span className="text-[12px] text-[var(--faint)] shrink-0 tabular-nums w-20 text-right">{t.fetched} fetched</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* Intelligence tier: external data + strategy (internal only) */}
          {s.intelligence && (
            <section className="px-4 sm:px-8 py-7 border-b border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)]">Intelligence</p>
              <p className="text-[12px] text-[var(--faint)] mt-1 mb-4">
                External data and strategy. Internal only — never client-facing. The score is unaffected.
              </p>

              {s.intelligence.psi?.pending ? (
                <p className="text-[13px] text-[var(--muted)]">{s.intelligence.psi.note}.</p>
              ) : s.intelligence.psi && (
                <div className="text-[13px]">
                  <span className="serif text-[15px] text-[var(--ink)]">Page speed</span>
                  <span className="text-[var(--muted)]"> — Google PageSpeed, {s.intelligence.fetched_at}: </span>
                  <span className="text-[var(--ink)] tabular-nums">
                    mobile {s.intelligence.psi.mobile?.score ?? "—"}/100 · desktop {s.intelligence.psi.desktop?.score ?? "—"}/100
                  </span>
                  {s.intelligence.psi.field ? (
                    <p className="mt-1 text-[var(--muted)]">
                      Real Chrome visitors (28 days): overall{" "}
                      <span style={{ color: s.intelligence.psi.field.overall === "FAST" ? "var(--good)" : s.intelligence.psi.field.overall === "SLOW" ? "var(--attn)" : "var(--improve)" }}>
                        {s.intelligence.psi.field.overall}
                      </span>
                      {s.intelligence.psi.field.lcp_ms && <> · main content visible {(s.intelligence.psi.field.lcp_ms / 1000).toFixed(1)}s</>}
                      {s.intelligence.psi.field.inp_ms && <> · reacts in {s.intelligence.psi.field.inp_ms}ms</>}
                    </p>
                  ) : s.intelligence.psi.field_note ? (
                    <p className="mt-1 text-[var(--faint)]">{s.intelligence.psi.field_note}.</p>
                  ) : null}
                </div>
              )}

              {(s.intelligence.competitors ?? []).length > 0 && (
                <div className="mt-5">
                  <p className="serif text-[15px] text-[var(--ink)] mb-2">Against the competitors named</p>
                  {[{ domain: run.domain, sitemap_pages: s.investigation?.pages_known ?? null, psi_mobile: s.intelligence.psi?.mobile?.score ?? null, self: true },
                    ...s.intelligence.competitors].map((c: any, i: number) => (
                    <div key={c.domain} className={`flex items-center gap-3 py-1.5 text-[13px] ${i > 0 ? "border-t border-[var(--hair)]" : ""}`}>
                      <span className={`flex-1 truncate ${c.self ? "font-semibold text-[var(--ink)]" : "text-[var(--ink)]"}`}>
                        {c.domain}{c.self ? " (this site)" : ""}{c.reachable === false ? " — unreachable" : ""}
                      </span>
                      <span className="w-20 sm:w-28 text-right tabular-nums text-[var(--muted)] text-[11px] sm:text-[13px]">
                        {c.sitemap_pages != null ? `${c.sitemap_pages} pages` : "no sitemap"}
                      </span>
                      <span className="w-20 sm:w-24 text-right tabular-nums text-[var(--muted)] text-[11px] sm:text-[13px]">
                        {c.psi_mobile != null ? `${c.psi_mobile}/100 mobile` : "—"}
                      </span>
                    </div>
                  ))}
                  <p className="mt-1 text-[11px] text-[var(--faint)]">Pages = sitemap URL counts; this site&apos;s figure is discovered URLs.</p>
                </div>
              )}

              {(s.intelligence.priorities ?? []).length > 0 && (
                <div className="mt-5">
                  <p className="serif text-[15px] text-[var(--ink)] mb-2">Priorities — v2.2 model</p>
                  {(s.intelligence.priorities as any[]).map((p, i) => (
                    <div key={p.check_id + i} className={`flex items-baseline gap-3 py-1.5 text-[13px] ${i > 0 ? "border-t border-[var(--hair)]" : ""}`}>
                      <span className="w-6 text-[var(--faint)] tabular-nums shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span className="serif w-16 shrink-0" style={{ color: SEV_COLOR[p.severity] }}>{p.severity}</span>
                      <span className="text-[var(--ink)] flex-1">{p.title}{p.below_line && <span className="text-[var(--faint)]"> · below the line</span>}</span>
                      <span className="tabular-nums text-[var(--muted)] shrink-0">{p.priority}</span>
                    </div>
                  ))}
                  <p className="mt-1 text-[11px] text-[var(--faint)]">
                    (Impact × Opportunity × Reach) ÷ Effort × Confidence. Critical items rank first regardless. Opportunity defaults to medium in v1.
                  </p>
                </div>
              )}

              {s.intelligence.plan && (
                <div className="mt-5">
                  <p className="serif text-[15px] text-[var(--ink)] mb-2">30 · 60 · 90 — internal delivery plan</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[["First 30 days", s.intelligence.plan.d30], ["Days 31–60", s.intelligence.plan.d60], ["Days 61–90", s.intelligence.plan.d90]].map(([label, items]: any) => (
                      <div key={label}>
                        <p className="text-[10px] tracking-[.12em] uppercase text-[var(--muted)] pb-1 border-b border-[var(--hair)]">{label}</p>
                        {items.length === 0 && <p className="pt-1.5 text-[12px] text-[var(--faint)]">Nothing in this window.</p>}
                        <ul className="pt-1.5 space-y-1">
                          {items.map((t: string) => <li key={t} className="text-[12px] text-[var(--ink)]">{t}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Findings */}
          {sorted.length > 0 && (
            <section className="px-4 sm:px-8 py-7">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)] mb-2">
                Findings — {sorted.length}
              </p>
              {sorted.map(findingRow)}
            </section>
          )}

          {/* Investigation patterns — never scored, never in the client PDF */}
          {invSorted.length > 0 && (
            <section className="px-4 sm:px-8 py-7 border-t border-[var(--hair)]">
              <p className="text-[11px] tracking-[.14em] uppercase text-[var(--muted)]">
                Site-wide patterns — {invSorted.length}
              </p>
              <p className="text-[12px] text-[var(--faint)] mt-1 mb-2">
                Below the scoring line. The score comes from the fixed core at every tier; these explain it.
              </p>
              {invSorted.map(findingRow)}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
