// DISCOVA Intelligence tier — external data and strategy, below the scoring line.
// PageSpeed lab + CrUX field data (free Google key), up to 3 user-supplied
// competitors, the v2.2 priority model over every finding, and an internal-only
// 30/60/90 plan. Locked P3 holds: nothing here moves the Visibility Score.
// Every number names its source; a missing key or missing field data is
// reported as exactly that, never papered over.

import { CATS } from "./scoring.js";

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

async function psiRun(url, strategy, key) {
  const q = new URLSearchParams({ url, strategy, key });
  const res = await fetch(`${PSI_ENDPOINT}?${q}`, { signal: AbortSignal.timeout(80_000) });
  if (!res.ok) throw new Error(`PSI ${strategy} ${res.status}`);
  const j = await res.json();
  const lh = j.lighthouseResult;
  const num = (id) => lh?.audits?.[id]?.numericValue ?? null;
  const fieldM = j.loadingExperience?.metrics;
  const field = j.loadingExperience?.overall_category
    ? {
        overall: j.loadingExperience.overall_category, // FAST | AVERAGE | SLOW
        lcp_ms: fieldM?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
        cls: fieldM?.CUMULATIVE_LAYOUT_SHIFT_SCORE ? fieldM.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
        inp_ms: fieldM?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
        origin_fallback: j.loadingExperience?.origin_fallback ?? false,
      }
    : null;
  return {
    strategy,
    score: lh?.categories?.performance?.score != null ? Math.round(lh.categories.performance.score * 100) : null,
    lcp_ms: num("largest-contentful-paint"),
    cls: num("cumulative-layout-shift"),
    tbt_ms: num("total-blocking-time"),
    field,
  };
}

async function competitorProbe(domain, { httpGet, key, log }) {
  const row = { domain, reachable: false };
  try {
    const home = await httpGet(`https://${domain}/`, { timeout: 15_000 });
    row.reachable = home.code === 200;
    row.status = home.code;
    const b = home.body ?? "";
    row.title = b.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, " ") ?? null;
    row.has_meta_desc = /<meta[^>]+name=["']description["']/i.test(b);
    row.words_as_served = b
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").split(" ").filter((w) => w.length > 1).length;
    const sm = await httpGet(`https://${domain}/sitemap.xml`, { timeout: 12_000 }).catch(() => null);
    row.sitemap_pages = sm?.code === 200 && /<(urlset|sitemapindex)/i.test(sm.body)
      ? (sm.body.match(/<loc>/g) ?? []).length
      : null;
  } catch (e) {
    log(`competitor ${domain} unreachable: ${e.message}`);
  }
  if (key && row.reachable) {
    row.psi_mobile = await psiRun(`https://${domain}/`, "mobile", key)
      .then((r) => r.score).catch(() => null);
  }
  return row;
}

// v2.2: (Impact x Opportunity x Reach) / Effort x Confidence.
// High=3 Med=2 Low=1; Effort QW=1 Low=1.5 Med=3 High=5. Critical first regardless.
const IMPACT = { critical: 3, high: 3, medium: 2, low: 1 };
const REACH = { high: 3, medium: 2, low: 1 };
const EFFORT = { quick_win: 1, low: 1.5, medium: 3, high: 5 };

export function buildPriorities(findings) {
  return findings
    .map((f) => {
      const I = IMPACT[f.severity] ?? 2;
      const O = 2; // v1 default: medium opportunity for every check; refined per-check as the register grows
      const R = REACH[f.reach] ?? 2;
      const E = EFFORT[f.effort] ?? 3;
      const C = f.confidence ?? 1;
      return {
        check_id: f.check_id, title: f.title, severity: f.severity,
        below_line: /^(inv|intel)-/.test(String(f.check_id)) || undefined,
        factors: { impact: I, opportunity: O, reach: R, effort: E, confidence: C },
        priority: Math.round(((I * O * R) / E) * C * 10) / 10,
      };
    })
    .sort((a, b) =>
      (b.severity === "critical" ? 1 : 0) - (a.severity === "critical" ? 1 : 0) ||
      b.priority - a.priority
    )
    .slice(0, 12);
}

export function buildPlan(priorities) {
  const effortOf = (p) => p.factors.effort;
  const pick = (fn, n) => priorities.filter(fn).slice(0, n).map((p) => p.title);
  return {
    d30: pick((p) => effortOf(p) <= 1.5, 6),          // quick wins and low effort
    d60: pick((p) => effortOf(p) === 3, 6),           // structured work
    d90: pick((p) => effortOf(p) === 5, 6),           // structural projects
  };
}

export async function intelligenceLayer(ctx, { competitors = [], httpGet, log, beat }) {
  const key = process.env.PSI_API_KEY;
  const base = ctx.probes.base ?? `https://${ctx.domain}`;
  const intel = { requested_competitors: competitors, fetched_at: new Date().toISOString().slice(0, 10) };
  const findings = [];
  const F = (f) => findings.push({
    evidence_label: "verified", verification: "none", confidence: 1.0, score_impact: 0, ...f,
  });

  // --- PageSpeed lab + field, mobile and desktop, in parallel ---
  if (!key) {
    intel.psi = { pending: true, note: "no PSI key configured; page-speed data arrives when PSI_API_KEY is set" };
    log("intelligence: PSI pending (no key)");
  } else {
    const [mobile, desktop] = await Promise.all([
      psiRun(base + "/", "mobile", key).catch((e) => ({ error: e.message })),
      psiRun(base + "/", "desktop", key).catch((e) => ({ error: e.message })),
    ]);
    intel.psi = { mobile, desktop, source: "Google PageSpeed Insights" };
    await beat().catch(() => {});
    const m = mobile?.score;
    if (m != null && m < 70) {
      const sev = m < 50 ? "high" : "medium";
      F({
        check_id: "intel-psi-mobile", category: CATS.S, severity: sev,
        title: "Google measures the site as slow on phones",
        evidence: `PageSpeed mobile performance ${m}/100 (lab, measured ${intel.fetched_at}). LCP ${mobile.lcp_ms ? (mobile.lcp_ms / 1000).toFixed(1) + "s" : "n/a"}, TBT ${mobile.tbt_ms != null ? Math.round(mobile.tbt_ms) + "ms" : "n/a"}.`,
        reach: "high", effort: "medium",
        internal_detail: `Lighthouse mobile ${m}/100; LCP ${mobile.lcp_ms}ms, CLS ${mobile.cls}, TBT ${mobile.tbt_ms}ms. Start with the largest render-blocking assets and image weight.`,
        client_summary: `Google's own measurement puts the site's phone loading speed at ${m} out of 100, and most Malaysian visitors arrive on a phone.`,
      });
    }
    const field = mobile?.field ?? desktop?.field ?? null;
    if (field) {
      intel.psi.field = field;
      if (field.overall === "SLOW" || field.overall === "AVERAGE") {
        F({
          check_id: "intel-cwv-field", category: CATS.S, severity: field.overall === "SLOW" ? "high" : "medium",
          title: "Real visitors experience the site as " + field.overall.toLowerCase(),
          evidence: `Chrome real-user data (28 days${field.origin_fallback ? ", whole-site" : ""}): overall ${field.overall}, LCP ${field.lcp_ms ? (field.lcp_ms / 1000).toFixed(1) + "s" : "n/a"}, INP ${field.inp_ms ?? "n/a"}ms, CLS ${field.cls ?? "n/a"}.`,
          reach: "high", effort: "medium",
          internal_detail: `CrUX field: ${JSON.stringify(field)}. This is what Google's ranking systems see; prioritise over lab numbers.`,
          client_summary: `Google's record of real visits rates the experience ${field.overall === "SLOW" ? "slow" : "average"}, and Google factors that into who gets shown first.`,
        });
      }
    } else {
      intel.psi.field = null;
      intel.psi.field_note = "no Chrome field data; the site has too little traffic in Google's dataset";
    }
  }

  // --- Competitors (max 3, user-supplied) ---
  if (competitors.length) {
    log(`intelligence: probing ${competitors.length} competitor(s)`);
    intel.competitors = [];
    for (const c of competitors.slice(0, 3)) {
      intel.competitors.push(await competitorProbe(c, { httpGet, key, log }));
      await beat().catch(() => {});
    }
    const subjPages = ctx.probes.sitemap?.count ?? 0;
    const withMaps = intel.competitors.filter((c) => (c.sitemap_pages ?? 0) > 0);
    if (withMaps.length && subjPages >= 0) {
      const smallest = Math.min(...withMaps.map((c) => c.sitemap_pages));
      if (subjPages < smallest / 2 && smallest >= 10) {
        F({
          check_id: "intel-competitor-footprint", category: CATS.K, severity: "high",
          title: "Competitors publish a far larger search footprint",
          evidence: `Competitor sitemaps: ${withMaps.map((c) => `${c.domain} ${c.sitemap_pages}`).join(", ")} pages vs ${subjPages} here (sitemap counts, ${intel.fetched_at}).`,
          reach: "high", effort: "high",
          internal_detail: `Competitors hold ${withMaps.map((c) => `${c.domain}=${c.sitemap_pages}`).join(", ")} indexed-candidate URLs vs ${subjPages}. Map their URL structures for the service/location matrix they rank with.`,
          client_summary: `The competitors named give Google ${smallest}+ pages to choose from while this site offers ${subjPages}, so they simply appear in more searches.`,
        });
      }
    }
  }

  return { intel, findings };
}
