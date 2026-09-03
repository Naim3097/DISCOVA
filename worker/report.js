// DISCOVA report builder — ports the lean.X print template (templates/report-print-head.html)
// into code. Client-facing: uses ONLY client-safe fields (title, client_summary, scores).
// internal_detail and evidence never enter this file's output.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const LOGO_B64 = readFileSync(join(here, "leanx-logo.png")).toString("base64");

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BANDS = ["Critical", "Developing", "Fair", "Good", "Excellent"];
// Deterministic band descriptors — fixed copy per band, not a per-site writer.
// The stage-6 writer layer replaces these with site-specific prose.
const BAND_LEAD = {
  Critical: "The foundations for being found have not been set up yet. The route to fixing that is unusually clear.",
  Developing: "The groundwork is real, but the site is leaving most of its visibility unclaimed.",
  Fair: "A sound site with specific, fixable gaps holding it below its potential.",
  Good: "A strong site. The gains left are refinements rather than repairs.",
  Excellent: "Competitive across the board. Optimisation now happens at the margins.",
};
const STATUS_COLOR = {
  "Needs attention": "var(--attn)",
  "Needs improvement": "var(--improve)",
  Fair: "var(--accent)",
  Good: "var(--good)",
};
const BAND_COLOR = {
  Critical: "var(--attn)", Developing: "var(--improve)", Fair: "var(--accent)",
  Good: "var(--good)", Excellent: "var(--good)",
};
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function buildReportHtml(run, findings) {
  const s = run.scores ?? {};
  const areas = s.areas ?? [];
  const subs = s.design_subscores ?? [];
  const gap = s.clearest_gap;
  const date = new Date(run.finished_at ?? run.started_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const recs = [...(findings ?? [])]
    .filter((f) => f.client_summary && !String(f.check_id ?? "").startsWith("inv-"))
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || a.score_impact - b.score_impact)
    .slice(0, 6);
  const gapMax = gap ? Math.max(gap.value_a, gap.value_b, 1) : 1;
  const gr = s.google_reality;
  const realityLine = gr && !gr.pending && !gr.error && typeof gr.indexed_pages === "number"
    ? `<div class="reality"><span class="lbl">GOOGLE TODAY</span>${
        gr.indexed_pages === 0
          ? "Google currently lists <b>none</b> of this site's pages"
          : `Google currently lists <b>${gr.indexed_at_least ? "10+" : gr.indexed_pages}</b> of this site's pages`
      }${
        gr.brand_found === false ? " &middot; a search for the business's own name does not find this site" :
        gr.brand_position ? ` &middot; found at position ${gr.brand_position} for its own name` : ""
      }${
        gr.domain_age_days != null && gr.domain_age_days < 180
          ? ` &middot; the web address is ${gr.domain_age_days} days old` : ""
      }${
        s.score_formula ? ` &middot; score = 60% readiness (${s.readiness}) + 40% Google presence (${s.presence})` : ""
      }.</div>`
    : "";

  const areaRow = (a, i) => `
    <div class="row">
      <span class="idx">${i + 1}</span><span class="nm">${esc(a.label)}</span>
      <span class="track"><i style="width:${a.score}%"></i></span><span class="val">${a.score}</span>
      <span class="st" style="color:${STATUS_COLOR[a.status] ?? "var(--muted)"}">${esc(a.status)}
        <em>&nbsp;${esc(a.note)}</em></span>
    </div>`;

  const dzRow = (d) => `
    <div class="dz"><span class="nm">${esc(d.area)}</span>
      <span class="track"><i style="width:${(d.points / d.max) * 100}%"></i></span>
      <span class="val">${d.points}/${d.max}</span>
      <span class="note">${esc(d.note)}</span></div>`;

  const recRow = (f, i) => `
    <div class="rec"><span class="n">0${i + 1}</span><div>
      <h3>${esc(f.title)}</h3><p>${esc(f.client_summary)}</p></div></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(run.domain)} — Website Visibility Check</title>
<style>
  @page { size: A4; margin: 13mm 19mm 11mm; }
  :root {
    --ink:#14252F; --body:#33454F; --muted:#6B7C86; --faint:#93A2AB;
    --rule:#C9D3D8; --hair:#DFE6E9; --track:#E8EDEF; --fill:#4A6472;
    --accent:#1F7E93; --attn:#8C1520; --improve:#8A550B; --good:#2C6549;
    --serif: Georgia, "Times New Roman", serif;
    --sans: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
  }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html,body { margin:0; padding:0; background:#FFF; }
  body { font-family:var(--sans); color:var(--body); font-size:9.2pt; line-height:1.43; }
  p { margin:0; }
  h1,h2,h3 { margin:0; font-family:var(--serif); font-weight:normal; color:var(--ink); }
  .letterhead { display:flex; justify-content:space-between; align-items:baseline;
    font-size:7.4pt; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); padding-bottom:2.2mm; }
  .letterhead .logo { height:9mm; width:auto; display:block; }
  .titleblock { border-top:1.6pt solid var(--ink); padding-top:2.8mm; margin-bottom:5mm; }
  .titleblock h1 { font-size:19pt; line-height:1.08; letter-spacing:-.01em; }
  .titleblock .subject { font-family:var(--serif); font-size:10.2pt; font-style:italic; margin-top:1.6mm; }
  .titleblock .subject .dom { font-style:normal; color:var(--muted); font-size:9.2pt; }
  h2.sec { font-family:var(--sans); font-size:7.4pt; font-weight:600; letter-spacing:.13em;
    text-transform:uppercase; color:var(--muted); border-bottom:.6pt solid var(--rule);
    padding-bottom:1.3mm; margin:5.5mm 0 3.6mm; }
  .overall { display:flex; gap:6.5mm; align-items:flex-start; margin-bottom:5.5mm; }
  .overall .fig { flex:0 0 auto; }
  .overall .fig .n { font-family:var(--serif); font-size:34pt; line-height:.78; color:var(--ink);
    letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
  .overall .fig .sc { font-family:var(--serif); font-size:11pt; color:var(--muted); }
  .overall .fig .cap { display:block; margin-top:1.8mm; font-size:6.8pt; letter-spacing:.1em;
    text-transform:uppercase; color:var(--muted); }
  .overall .right { flex:1 1 auto; }
  .overall .lead { font-family:var(--serif); font-size:11.2pt; color:var(--ink); line-height:1.3; }
  .scale { margin-top:3.4mm; }
  .reality { margin-top:2.8mm; font-size:8pt; line-height:1.45; color:var(--ink);
    border-top:.5pt solid var(--hair); padding-top:2mm; }
  .reality .lbl { font-size:6.6pt; letter-spacing:.1em; color:var(--muted); display:block; margin-bottom:.8mm; }
  .scale .bands { display:flex; height:3.4mm; gap:.7mm; }
  .scale .bands span { flex:1 1 0; background:var(--track); }
  .scale .marks { display:flex; margin-top:1.1mm; font-size:6.4pt; letter-spacing:.05em;
    text-transform:uppercase; color:var(--faint); }
  .scale .marks span { flex:1 1 0; text-align:center; }
  .row { display:grid; grid-template-columns:4mm 42mm 1fr 8mm; align-items:center; gap:2.8mm;
    padding:1.8mm 0; border-top:.5pt solid var(--hair); }
  .row:first-of-type { border-top:none; }
  .row .idx { font-family:var(--serif); font-size:8.2pt; color:var(--faint); }
  .row .nm { font-family:var(--serif); font-size:10.2pt; color:var(--ink); }
  .row .track { height:3mm; background:var(--track); }
  .row .track i { display:block; height:100%; background:var(--fill); }
  .row .val { font-size:8.4pt; text-align:right; color:var(--ink); font-variant-numeric:tabular-nums; }
  .row .st { grid-column:2/5; font-family:var(--serif); font-variant:small-caps; font-size:8.9pt;
    letter-spacing:.04em; margin-top:-.5mm; }
  .row .st em { font-style:normal; font-variant:normal; font-family:var(--sans); font-size:8.3pt; color:var(--muted); }
  .dz { display:grid; grid-template-columns:38mm 24mm 8mm 1fr; align-items:center; gap:2.8mm;
    padding:1.5mm 0; border-top:.5pt solid var(--hair); }
  .dz:first-of-type { border-top:none; }
  .dz .nm { font-family:var(--serif); font-size:9.6pt; color:var(--ink); }
  .dz .track { height:2.6mm; background:var(--track); }
  .dz .track i { display:block; height:100%; background:var(--fill); }
  .dz .val { font-size:8.2pt; text-align:right; color:var(--ink); font-variant-numeric:tabular-nums; }
  .dz .note { font-size:8.2pt; color:var(--muted); }
  .cmp-row { display:grid; grid-template-columns:50mm 1fr 11mm; align-items:center; gap:2.8mm; margin-bottom:2.2mm; }
  .cmp-row .lbl { font-size:8.6pt; } .cmp-row .lbl b { color:var(--ink); font-weight:600; }
  .cmp-row .track { height:4mm; background:var(--track); }
  .cmp-row .track i { display:block; height:100%; background:var(--fill); }
  .cmp-row .track i.you { background:var(--attn); }
  .cmp-row .num { font-family:var(--serif); font-size:11.5pt; color:var(--ink); text-align:right;
    font-variant-numeric:tabular-nums; }
  .cmp-note { font-size:7.8pt; color:var(--muted); margin-top:1.3mm; }
  .win { list-style:none; margin:0; padding:0; }
  .win li { font-size:8.6pt; padding:1mm 0; }
  .win li::before { content:"✓  "; color:var(--good); }
  .rec { display:grid; grid-template-columns:7.5mm 1fr; gap:2.8mm; padding:2.2mm 0; border-top:.5pt solid var(--hair); }
  .rec:first-of-type { border-top:none; }
  .rec .n { font-family:var(--serif); font-size:11.5pt; color:var(--accent); font-variant-numeric:tabular-nums; }
  .rec h3 { font-size:10.4pt; margin-bottom:.6mm; }
  .rec p { font-size:8.8pt; }
  .closing strong { color:var(--ink); font-weight:600; }
  .closing p { font-size:9pt; }
  .nextstep { margin-top:3.4mm; padding-top:2.4mm; border-top:.6pt solid var(--rule); }
  .nextstep .k { font-family:var(--serif); font-style:italic; font-size:10.2pt; color:var(--ink); }
  .colophon { margin-top:6mm; padding-top:2.2mm; border-top:.5pt solid var(--hair);
    font-size:7pt; line-height:1.4; color:var(--muted); }
  .pbreak { break-before:page; page-break-before:always; }
</style>
</head>
<body>

<div class="letterhead">
  <img class="logo" src="data:image/png;base64,${LOGO_B64}" alt="lean.X digital">
  <span>${esc(date)}</span>
</div>

<div class="titleblock">
  <h1>Website Visibility Check</h1>
  <p class="subject">${esc(run.domain)} &nbsp;<span class="dom">${esc(run.tier)} depth</span></p>
</div>

<div class="overall">
  <div class="fig"><span class="n">${s.overall ?? "—"}</span><span class="sc">/100</span>
    <span class="cap">Overall health</span></div>
  <div class="right">
    <p class="lead">${esc(s.narrative?.lead ?? BAND_LEAD[s.band] ?? "")}</p>
    ${s.narrative?.sub ? `<p style="margin-top:2mm; font-size:8.8pt;">${esc(s.narrative.sub)}</p>` : ""}
    <div class="scale">
      <div class="bands">${BANDS.map((b) =>
        `<span${b === s.band ? ` style="background:${BAND_COLOR[b]}"` : ""}></span>`).join("")}</div>
      <div class="marks">${BANDS.map((b) =>
        `<span${b === s.band ? ` style="color:${BAND_COLOR[b]};font-weight:600"` : ""}>${b}</span>`).join("")}</div>
    </div>
    ${realityLine}
  </div>
</div>

<h2 class="sec">Where you stand</h2>
${areas.map(areaRow).join("")}

${subs.length ? `<h2 class="sec">Design &amp; brand review</h2>
<p style="margin-bottom:3mm; font-size:8.8pt;">Assessed against 24 standard criteria across five areas. ${s.design_total?.points ?? ""} were met.</p>
${subs.map(dzRow).join("")}` : ""}

<div class="pbreak"></div>

${gap ? `<h2 class="sec">The clearest gap</h2>
<div class="cmp-row"><span class="lbl"><b>${esc(gap.label_a)}</b><br>${esc(gap.sub_a ?? "")}</span>
  <span class="track"><i style="width:${(gap.value_a / gapMax) * 100}%"></i></span>
  <span class="num">${gap.value_a}</span></div>
<div class="cmp-row"><span class="lbl"><b>${esc(gap.label_b)}</b><br>${esc(gap.sub_b ?? "")}</span>
  <span class="track"><i class="you" style="width:${Math.max((gap.value_b / gapMax) * 100, 1.5)}%"></i></span>
  <span class="num">${gap.value_b}</span></div>
<p class="cmp-note">${esc(gap.note ?? "")}</p>` : ""}

${(s.strengths ?? []).length ? `<h2 class="sec">What is working</h2>
<ul class="win">${s.strengths.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}

<h2 class="sec">Our priority recommendations</h2>
${recs.map(recRow).join("")}

${s.narrative ? `<h2 class="sec">What this means</h2>
<div class="closing">
  <p><strong>${esc(s.narrative.closing_strong)}</strong> ${esc(s.narrative.closing_rest)}</p>
  <div class="nextstep"><p><span class="k">Recommended next step.</span> ${esc(s.narrative.next_step)}</p></div>
</div>` : ""}

<div class="colophon">
  DISCOVA · powered by lean.X digital — Website Visibility Check for ${esc(run.domain)},
  generated ${esc(date)} at ${esc(run.tier)} depth under framework v${esc(run.framework_version)}.
  Based on over 100 individual technical checks and 24 design criteria. Findings are presented
  at summary level; the detailed breakdown forms part of the full optimisation programme.
</div>

</body>
</html>`;
}

export function countPdfPages(buffer) {
  const text = buffer.toString("latin1");
  const m = text.match(/\/Count\s+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}
