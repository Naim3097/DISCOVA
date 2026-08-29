// DISCOVA Investigation tier — the site as a system.
// Crawls site-wide within the locked caps (E1: max 2 concurrent, 500ms delay,
// 15s timeouts, 50-200 pages sampled by URL template, <=5 fetches per template),
// clusters URLs by path shape, and reports patterns BELOW the scoring line
// (score_impact 0, locked P3) — the Visibility Score never changes with tier.
// Every count states its denominator; nothing is claimed beyond what was fetched.

import { CATS } from "./scoring.js";

const CAPS = {
  maxFetch: 200,
  perTemplate: 5,
  deadlineMs: 270_000, // hard stop at 4.5 min — reported honestly if hit
  concurrency: 2,
  delayMs: 500,
  timeout: 15_000,
};

const SKIP_EXT = /\.(jpe?g|png|gif|webp|avif|svg|ico|css|js|mjs|map|json|xml|rss|atom|pdf|zip|rar|7z|gz|mp3|mp4|webm|avi|mov|wmv|woff2?|ttf|eot|otf|docx?|xlsx?|pptx?|txt|csv|ics)([?#]|$)/i;

function normalise(href, base) {
  let u;
  try { u = new URL(href, base); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const baseHost = new URL(base).host.replace(/^www\./, "");
  if (u.host.replace(/^www\./, "") !== baseHost) return null;
  if (SKIP_EXT.test(u.pathname)) return null;
  if (u.searchParams.has("add-to-cart") || u.searchParams.has("remove_item")) return null; // cart ACTIONS, not pages
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_w+|fbclid|gclid|mc_cid|mc_eid|replytocom|orderby|rating_filter|min_price|max_price|filter_w+|add_to_wishlist)$/i.test(k)) {
      u.searchParams.delete(k);
    }
  }
  u.hash = "";
  let path = u.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/$/, "");
  return u.origin + path + (u.search ? "?" + [...u.searchParams.keys()].sort().map((k) => k + "=" + (u.searchParams.get(k) ?? "")).join("&") : "");
}

// Path shape: digit runs -> {n}, hex ids -> {id}; query keeps sorted param NAMES only.
function shapeOf(url) {
  const u = new URL(url);
  const segs = u.pathname.split("/").filter(Boolean).map((s) =>
    /^\d+$/.test(s) ? "{n}"
    : /^[0-9a-f]{8,}(-[0-9a-f]{4,}){0,4}$/i.test(s) ? "{id}"
    : s
  );
  const q = u.search ? "?" + [...u.searchParams.keys()].sort().join("&") : "";
  return "/" + segs.join("/") + q;
}

const parentOf = (shape) => shape.split("?")[0].split("/").slice(0, -1).join("/") || "/";

function parsePage(body) {
  const b = (body ?? "").slice(0, 250_000);
  const attr = (rx1, rx2) => b.match(rx1)?.[1] ?? b.match(rx2)?.[1] ?? null;
  const text = b
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return {
    title: b.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, " ") ?? null,
    metaDesc: attr(
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']{1,400})/i,
      /<meta[^>]+content=["']([^"']{1,400})["'][^>]*name=["']description["']/i
    ),
    canonical: attr(
      /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i,
      /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i
    ),
    noindex: /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(b),
    h1Count: (b.match(/<h1[\s>]/gi) ?? []).length,
    words: text.split(" ").filter((w) => w.length > 1).length,
    links: [...b.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 400),
  };
}

export async function surveySite(ctx, { httpGet, log, beat }) {
  const base = ctx.probes.base ?? `https://${ctx.domain}`;
  const t0 = Date.now();
  const known = new Map(); // url -> shape (discovery order preserved)
  const parentChildren = new Map(); // parent shape -> Set of child shapes
  const queue = [];

  const add = (raw) => {
    const url = normalise(raw, base);
    if (!url || known.has(url)) return;
    const shape = shapeOf(url);
    known.set(url, shape);
    const p = parentOf(shape);
    if (!parentChildren.has(p)) parentChildren.set(p, new Set());
    parentChildren.get(p).add(shape);
    queue.push(url);
  };

  // A template collapses to parent/{slug} once a parent has >8 distinct children.
  // The site root never collapses: top-level pages are usually distinct pages,
  // not one CMS template — collapsing them starves the survey of coverage.
  const templateOf = (url) => {
    const shape = known.get(url) ?? shapeOf(url);
    const p = parentOf(shape);
    return p !== "/" && (parentChildren.get(p)?.size ?? 0) > 8 ? `${p}/{slug}` : shape;
  };

  add(base + "/");
  for (const u of ctx.probes.sitemap?.urls ?? []) add(u);
  for (const p of ctx.dom.internalPaths ?? []) add(p);
  const sitemapSet = new Set((ctx.probes.sitemap?.urls ?? []).map((u) => normalise(u, base)).filter(Boolean));

  const pages = [];
  const perTemplate = new Map();
  let skippedSampling = 0, qi = 0, capHit = false, deadlineHit = false;

  async function worker() {
    for (;;) {
      if (pages.length >= CAPS.maxFetch) { capHit = queue.length > qi; return; }
      if (Date.now() - t0 > CAPS.deadlineMs) { deadlineHit = true; return; }
      const url = queue[qi++];
      if (url === undefined) {
        if (pages.length && qi >= queue.length) return; // frontier exhausted
        await new Promise((r) => setTimeout(r, 200)); qi--; continue;
      }
      const tpl = templateOf(url);
      if ((perTemplate.get(tpl) ?? 0) >= CAPS.perTemplate) { skippedSampling++; continue; }
      perTemplate.set(tpl, (perTemplate.get(tpl) ?? 0) + 1);

      const r = await httpGet(url, { timeout: CAPS.timeout }).catch(() => null);
      const rec = {
        url, template: tpl,
        status: r?.code ?? 0,
        hops: r?.hops ?? 0,
        inSitemap: sitemapSet.has(url),
      };
      if (r && r.code === 200 && /text\/html/.test(r.headers?.["content-type"] ?? "text/html")) {
        Object.assign(rec, parsePage(r.body));
        for (const l of rec.links ?? []) add(l);
        delete rec.links;
      }
      pages.push(rec);
      if (pages.length % 15 === 0) {
        await beat().catch(() => {});
        log(`survey: ${pages.length} fetched, ${known.size} known, ${perTemplate.size} templates`);
      }
      await new Promise((r2) => setTimeout(r2, CAPS.delayMs));
    }
  }
  await Promise.all(Array.from({ length: CAPS.concurrency }, () => worker()));
  // Re-stamp templates with the final cluster picture: pages fetched before a
  // parent crossed the slug-collapse threshold would otherwise split clusters.
  for (const p of pages) p.template = templateOf(p.url);

  const dur = Math.round((Date.now() - t0) / 1000);
  log(`survey done: ${pages.length} pages in ${dur}s, ${perTemplate.size} templates, ${skippedSampling} sampled out${capHit ? ", cap hit" : ""}${deadlineHit ? ", deadline hit" : ""}`);

  const patterns = detectPatterns(pages, { base, renderedWords: ctx.dom?.words ?? null });
  const templates = [...perTemplate.entries()]
    .map(([template, fetched]) => ({
      template,
      known: [...known.values()].filter((s) => {
        const p = parentOf(s);
        return p !== "/" && (parentChildren.get(p)?.size ?? 0) > 8
          ? `${p}/{slug}` === template : s === template;
      }).length,
      fetched,
    }))
    .sort((a, b) => b.known - a.known)
    .slice(0, 12);

  return {
    pages,
    patterns,
    summary: {
      pages_known: known.size,
      pages_fetched: pages.length,
      sampled_out: skippedSampling,
      templates,
      cap_hit: capHit,
      deadline_hit: deadlineHit,
      duration_s: dur,
      caps: { max_fetch: CAPS.maxFetch, per_template: CAPS.perTemplate },
    },
  };
}

const path = (u) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };
const egs = (arr, n = 3) => arr.slice(0, n).map((p) => path(p.url)).join("  ");

function detectPatterns(pages, { base, renderedWords }) {
  const out = [];
  const ok = pages.filter((p) => p.status === 200 && p.title !== undefined);
  const F = (f) => out.push({
    evidence_label: "verified", verification: "raw_html", confidence: 1.0,
    score_impact: 0, ...f,
  });
  const denom = `${ok.length} pages surveyed`;
  const thin = ok.filter((p) => p.words < 120);
  const jsOnly = (renderedWords ?? 0) >= 200 && ok.length >= 3 && thin.length / ok.length >= 0.8;
  const asServed = () => jsOnly ? " Measured on pages as served, before scripts run." : "";

  const broken = pages.filter((p) => [404, 410].includes(p.status));
  if (broken.length)
    F({
      check_id: "inv-broken-internal", category: CATS.U, severity: "high",
      title: "Pages on the site link to addresses that no longer exist",
      evidence: `${broken.length} of ${pages.length} fetched URLs returned not-found. e.g. ${egs(broken)}`,
      reach: broken.length > 5 ? "high" : "medium", effort: "low",
      internal_detail: `Fix or remove internal links to: ${broken.map((p) => path(p.url)).slice(0, 10).join(", ")}. Add 301s where the content moved.`,
      client_summary: `${broken.length} links inside the website lead visitors to dead ends, which wastes clicks and erodes trust in the rest of the site.`,
    });

  const errors = pages.filter((p) => p.status >= 500);
  if (errors.length)
    F({
      check_id: "inv-server-errors", category: CATS.T, severity: "high",
      title: "Some pages fail outright when opened",
      evidence: `${errors.length} URLs returned a server error (5xx). e.g. ${egs(errors)}`,
      reach: "medium", effort: "medium",
      internal_detail: `5xx responses at: ${errors.map((p) => `${path(p.url)} (${p.status})`).slice(0, 8).join(", ")}. Check server logs for these routes.`,
      client_summary: `${errors.length} pages simply fail to open, so anything they were meant to sell or explain is unreachable.`,
    });

  // Duplicate titles, attributed to their template — the locked target shape.
  const byTpl = new Map();
  for (const p of ok) {
    if (!byTpl.has(p.template)) byTpl.set(p.template, []);
    byTpl.get(p.template).push(p);
  }
  const dupClusters = [];
  for (const [tpl, list] of byTpl) {
    if (list.length < 3) continue;
    const counts = new Map();
    for (const p of list) if (p.title) counts.set(p.title, (counts.get(p.title) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3 && top[1] / list.length >= 0.8)
      dupClusters.push({ tpl, title: top[0], n: top[1], of: list.length });
  }
  if (dupClusters.length) {
    const total = dupClusters.reduce((s, c) => s + c.n, 0);
    F({
      check_id: "inv-dup-title-template", category: CATS.O, severity: total >= 20 ? "high" : "medium",
      title: "Whole sections share one identical page title",
      evidence: dupClusters.slice(0, 3).map((c) => `${c.n} of ${c.of} pages on template ${c.tpl} are titled "${c.title.slice(0, 70)}"`).join(" · ") + asServed(),
      reach: "high", effort: "medium",
      internal_detail: `Template-level title tags: ${dupClusters.slice(0, 4).map((c) => `${c.tpl} (${c.n}x "${c.title.slice(0, 60)}")`).join("; ")}${dupClusters.length > 4 ? ` (+${dupClusters.length - 4} more templates)` : ""}. Generate per-page titles from the page's own subject in each template.`,
      client_summary: `${total} pages introduce themselves to Google with the exact same name, so they compete with each other instead of each winning its own search.`,
    });
  }

  const noMeta = ok.filter((p) => !p.metaDesc);
  if (noMeta.length >= 5 && noMeta.length / ok.length >= 0.3) {
    const tplCounts = new Map();
    for (const p of noMeta) tplCounts.set(p.template, (tplCounts.get(p.template) ?? 0) + 1);
    const worst = [...tplCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    F({
      check_id: "inv-missing-meta-sitewide", category: CATS.O, severity: "medium",
      title: "Most pages leave their search snippet to chance",
      evidence: `${noMeta.length} of ${denom} have no meta description${worst && worst[1] >= 3 ? `; ${worst[1]} sit on the same template (${worst[0]})` : ""}.` + asServed(),
      reach: "high", effort: "medium",
      internal_detail: `Missing meta descriptions concentrated in template ${worst?.[0] ?? "n/a"}. Wire the template's excerpt/summary field into the description tag; hand-write the top commercial pages.`,
      client_summary: `${noMeta.length} pages let Google improvise their sales pitch in search results instead of stating it, which costs clicks the site already earned.`,
    });
  }

  if (jsOnly)
    F({
      check_id: "inv-js-only-content", category: CATS.T, severity: "medium",
      title: "Pages are blank until scripts assemble them",
      evidence: `${thin.length} of ${denom} contain under 120 words as served; the homepage shows ${renderedWords} words once scripts run.`,
      reach: "high", effort: "medium",
      internal_detail: "Site is client-side rendered; ship server-rendered or pre-rendered HTML for indexable routes so content, headings and copy exist before JS executes.",
      client_summary: `${thin.length} of the pages checked are empty until the visitor's browser assembles them, so search engines and link previews reading the page as sent see almost nothing.`,
    });
  if (!jsOnly && thin.length >= 3)
    F({
      check_id: "inv-thin-pages", category: CATS.C, severity: thin.length / ok.length > 0.5 ? "medium" : "low",
      title: "A run of pages says almost nothing",
      evidence: `${thin.length} of ${denom} carry under 120 readable words. e.g. ${egs(thin)}`,
      reach: "medium", effort: "medium",
      internal_detail: `Thin pages (<120 words): ${thin.map((p) => `${path(p.url)} (${p.words}w)`).slice(0, 8).join(", ")}. Merge, expand, or noindex.`,
      client_summary: `${thin.length} pages are too thin to convince either a visitor or a search engine, so they occupy space without earning anything.`,
    });

  const noindexed = ok.filter((p) => p.noindex && p.inSitemap);
  if (noindexed.length)
    F({
      check_id: "inv-noindex-in-sitemap", category: CATS.T, severity: "medium",
      title: "The site tells Google to visit pages it also tells Google to ignore",
      evidence: `${noindexed.length} pages are listed in the sitemap yet marked noindex. e.g. ${egs(noindexed)}`,
      reach: "medium", effort: "quick_win",
      internal_detail: `Remove from sitemap or drop the noindex on: ${noindexed.map((p) => path(p.url)).slice(0, 8).join(", ")}.`,
      client_summary: `The site gives Google contradictory instructions about ${noindexed.length} of its own pages, which wastes the attention Google allocates to it.`,
    });

  const redirected = pages.filter((p) => p.hops >= 1 && p.status === 200);
  if (redirected.length >= 5)
    F({
      check_id: "inv-internal-redirects", category: CATS.T, severity: "low",
      title: "Internal links take a detour before arriving",
      evidence: `${redirected.length} of ${pages.length} fetched URLs redirect before resolving. e.g. ${egs(redirected)}`,
      reach: "medium", effort: "low",
      internal_detail: `Update internal links to their final destinations (currently passing through ${redirected.length} redirects).`,
      client_summary: `${redirected.length} internal links send visitors the long way round, which slows every one of those journeys slightly.`,
    });

  const badH1 = ok.filter((p) => p.h1Count !== 1);
  if (!jsOnly && badH1.length >= 5 && badH1.length / ok.length >= 0.3)
    F({
      check_id: "inv-heading-structure", category: CATS.O, severity: "low",
      title: "Pages are inconsistent about announcing their own subject",
      evidence: `${badH1.length} of ${denom} have zero or multiple main headings.`,
      reach: "medium", effort: "medium",
      internal_detail: `${badH1.filter((p) => p.h1Count === 0).length} pages with no h1, ${badH1.filter((p) => p.h1Count > 1).length} with several. Fix at template level.`,
      client_summary: `${badH1.length} pages never state their subject clearly at the top, which makes both readers and search engines work harder than they will.`,
    });

  const canonElsewhere = ok.filter((p) => {
    if (!p.canonical) return false;
    const c = normalise(p.canonical, base);
    return c && c !== p.url;
  });
  if (canonElsewhere.length >= 3)
    F({
      check_id: "inv-canonical-elsewhere", category: CATS.T, severity: "medium",
      title: "Pages credit their search value to a different address",
      evidence: `${canonElsewhere.length} of ${denom} point search engines at a different URL than the one that opens. e.g. ${egs(canonElsewhere)}`,
      reach: "medium", effort: "medium",
      internal_detail: `Canonical mismatches: ${canonElsewhere.map((p) => `${path(p.url)} -> ${p.canonical}`).slice(0, 5).join("; ")}. Verify intended; self-canonicalise otherwise.`,
      client_summary: `${canonElsewhere.length} pages hand their search credit to another address, so the work they do never shows up under their own name.`,
    });

  return out;
}
