// DISCOVA Google-reality check — observed presence, kept beside the score,
import { usage } from "./usage.js";
// never inside it. The audit score means "how ready the site is"; this module
// answers "can anyone actually find it": pages Google lists (official Custom
// Search API), whether the site surfaces for its own name, and domain age
// (registry RDAP, no key). Missing keys or registry silence are reported as
// exactly that. Nothing here moves the Visibility Score.

const CSE = "https://www.googleapis.com/customsearch/v1";

// Primary index source: serper.dev (real Google results; Google deprecated
// whole-web Programmable Search Engines, closing the official free route).
// gl=my so results match what Malaysian searchers actually see.
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function serperQuery(q, key, attempt = 0) {
  usage.searches++;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "X-API-KEY": key, "content-type": "application/json" },
    body: JSON.stringify({ q, gl: "my", num: 10 }),
  });
  if (!res.ok) {
    if ((res.status === 429 || res.status >= 500) && attempt === 0) {
      await sleep(1500);
      return serperQuery(q, key, 1);
    }
    throw new Error(`serper ${res.status}`);
  }
  const j = await res.json();
  const items = (j.organic ?? []).map((o) => ({ link: o.link }));
  // serper returns no total count: a full page of results means "at least this many".
  return { total: items.length, page_full: items.length >= 10, items };
}

async function cseAdapter(q, key, cx) {
  const j = await cseQuery(q, key, cx);
  return {
    total: Number(j.searchInformation?.totalResults ?? 0),
    page_full: false,
    items: (j.items ?? []).map((i) => ({ link: i.link })),
  };
}

async function cseQuery(q, key, cx) {
  usage.searches++;
  const u = `${CSE}?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&num=10`;
  const res = await fetch(u, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`CSE ${res.status}`);
  return res.json();
}

async function domainAgeDays(domain) {
  const apex = domain.replace(/^www\./, "");
  const tld = apex.split(".").pop();
  const urls = ["com", "net"].includes(tld)
    ? [`https://rdap.verisign.com/${tld}/v1/domain/${apex}`]
    : [`https://rdap.org/domain/${apex}`];
  for (const u of urls) {
    try {
      const res = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const j = await res.json();
      const reg = (j.events ?? []).find((e) => e.eventAction === "registration")?.eventDate;
      if (reg) return { registered: reg.slice(0, 10), age_days: Math.round((Date.now() - new Date(reg).getTime()) / 86_400_000) };
    } catch { /* registry silent — reported as unknown */ }
  }
  return null;
}

export function makeSearch() {
  const serper = process.env.SERPER_API_KEY;
  const key = process.env.GOOGLE_CSE_KEY, cx = process.env.GOOGLE_CSE_CX;
  return serper
    ? (q) => serperQuery(q, serper)
    : key && cx
      ? (q) => cseAdapter(q, key, cx)
      : null;
}

// The searches a real customer would type, derived from the site's own words
// with the BRAND REMOVED: a query containing the business name proves nothing
// about whether strangers can find it. Only the non-branded remainder is tested.
export function brandTokensFor(ctx, domain) {
  const brandLabel = domain.split(".")[0].toLowerCase();
  return {
    brandLabel,
    brandWords: new Set(
      [
        ...(deriveBrand(ctx, domain).primary.toLowerCase().match(/[a-z0-9]+/g) ?? []),
        brandLabel,
      ].filter((t) => t.length >= 3)
    ),
  };
}

export function isBrandedTerm(ctx, domain, term) {
  const { brandLabel, brandWords } = brandTokensFor(ctx, domain);
  return (term.toLowerCase().match(/[a-z0-9]+/g) ?? []).some(
    (w) => brandWords.has(w) || (w.length >= 5 && brandLabel.includes(w))
  );
}

export function deriveServiceQueries(ctx) {
  const domain = (ctx.domain ?? "").replace(/^www\./, "");
  const { brandLabel, brandWords } = brandTokensFor(ctx, domain);
  const stripBrand = (q) =>
    q.split(/\s+/)
      .filter((w) => {
        const lw = w.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!lw) return false;
        if (brandWords.has(lw)) return false;
        if (lw.length >= 5 && brandLabel.includes(lw)) return false;
        return true;
      })
      .join(" ")
      .replace(/^(with|for|by|the|and|in|of|to)\s+/i, "")
      .replace(/\s+(with|for|by|the|and|in|of|to)$/i, "")
      .trim();
  const generic = /^(home|welcome( to)?|about( us)?|services|our services|contact( us)?|utama|laman utama|laman rasmi|selamat datang|official( website| site)?|website|index)$/i;
  const cands = [];
  const segs = (ctx.dom?.title ?? "").split(/[|\-–—·:]/).map((s) => s.trim()).filter(Boolean);
  cands.push(...segs.slice(1));
  cands.push(...(ctx.dom?.h1s ?? []));
  const seen = new Set();
  const out = [];
  for (const c of cands) {
    const q = stripBrand((c ?? "").replace(/\s+/g, " ").trim());
    const key2 = q.toLowerCase();
    if (q.length < 8 || q.length > 70) continue;
    if (q.split(" ").length < 2) continue;
    if (generic.test(q)) continue;
    if (seen.has(key2)) continue;
    seen.add(key2);
    out.push(q.slice(0, 70));
    if (out.length === 3) break;
  }
  return out;
}

// The business's name, not the page's: prefer the title segment whose
// letters match the domain label; never a generic like "Home".
export function deriveBrand(ctx, domain) {
  const label = domain.split(".")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  const generic = /^(home|homepage|welcome|index|about( us)?|utama|laman utama|official( website)?)$/i;
  const segs = (ctx.dom?.title ?? "").split(/[|\-–—·:]/).map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 60 && !generic.test(s));
  let best = null;
  for (const s of segs) {
    const norm = s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm && (norm.includes(label) || label.includes(norm))) { best = s; break; }
  }
  const primary = best ?? segs[0] ?? domain.split(".")[0];
  const primNorm = primary.toLowerCase().replace(/[^a-z0-9]/g, "");
  return { primary, fallback: primNorm === label ? null : domain.split(".")[0] };
}

export async function googleReality(ctx, { log, searchOverride = null, manualTerms = [] }) {
  const domain = ctx.domain.replace(/^www\./, "");
  const search = searchOverride ?? makeSearch(); // override exists for the self-test only
  const out = { checked_at: new Date().toISOString().slice(0, 10) };

  const age = await domainAgeDays(ctx.domain);
  if (age) { out.domain_registered = age.registered; out.domain_age_days = age.age_days; }

  out.service_query_candidates = deriveServiceQueries(ctx);
  if (!search) {
    out.pending = true;
    out.note = "Google index data arrives when SERPER_API_KEY is set";
    log("google reality: index check pending (no search key)");
    return out;
  }
  out.source = process.env.SERPER_API_KEY ? "serper.dev (Google results)" : "Google Custom Search";

  try {
    const site = await search(`site:${domain}`);
    // Google substitutes general results when a site: query finds little -
    // only URLs actually on this domain count as indexed pages.
    const own = site.items.filter((i) => {
      try {
        const h = new URL(i.link).hostname.replace(/^www\./, "");
        return h === domain || h.endsWith("." + domain);
      } catch { return false; }
    });
    out.indexed_pages = own.length;
    out.indexed_at_least = own.length >= 10; // full page of OWN results = "10+", a floor

    const findPos = (items) => items.findIndex((i) => {
      try { return new URL(i.link).hostname.replace(/^www\./, "") === domain; } catch { return false; }
    });
    const { primary, fallback } = deriveBrand(ctx, domain);
    out.brand_query = primary;
    await sleep(600);
    let pos = findPos((await search(`"${primary}"`)).items);
    if (pos === -1 && fallback) {
      await sleep(600);
      out.brand_query = `${primary}" / "${fallback}`;
      pos = findPos((await search(`"${fallback}"`)).items);
    }
    out.brand_found = pos !== -1;
    if (pos !== -1) out.brand_position = pos + 1;

    const manual = (manualTerms ?? []).filter((t) => t && t.length >= 4).slice(0, 3);
    const candidates = manual.length ? manual : deriveServiceQueries(ctx);
    out.terms_source = manual.length ? "manual" : "derived";
    out.service_queries = [];
    for (const q of candidates) {
      await sleep(600);
      const sres = await search(q);
      const spos = sres.items.findIndex((i) => {
        try { return new URL(i.link).hostname.replace(/^www\./, "").endsWith(domain); } catch { return false; }
      });
      out.service_queries.push({
        q,
        position: spos === -1 ? null : spos + 1,
        branded: isBrandedTerm(ctx, domain, q) || undefined, // branded terms shown but never scored
      });
    }
    if (out.service_queries.length)
      log(`google reality: service queries ${out.service_queries.map((s) => `"${s.q}" ${s.position ? "#" + s.position : "not top 10"}`).join(" | ")}`);
    else log("google reality: no service phrases derivable from the page itself");

    out.invisible = out.indexed_pages === 0;
    out.outranked_for_own_name = !out.invisible && !out.brand_found;
    log(`google reality: ${out.indexed_pages} pages indexed, brand "${out.brand_query}" ${out.brand_found ? "found #" + out.brand_position : "NOT found in top 10"}`);
  } catch (e) {
    out.error = `index check failed: ${e.message}`;
    log("google reality: " + out.error);
  }
  return out;
}

// Client-safe one-liner for the writer. Only states what was measured.
export function realityForWriter(gr) {
  if (!gr || gr.pending || gr.error) return null;
  const bits = [];
  if (gr.indexed_pages === 0) bits.push("Google currently lists NONE of this site's pages");
  else if (gr.indexed_at_least) bits.push("Google lists this site's pages in healthy numbers (a full page of results and more)");
  else bits.push(`Google lists ${gr.indexed_pages} of this site's pages`);
  if (gr.brand_found === false) bits.push("a search for the business's own name does not surface this site in the top ten");
  else if (gr.brand_position) bits.push(`the site appears at position ${gr.brand_position} for its own name`);
  if (gr.domain_age_days != null && gr.domain_age_days < 180) {
    bits.push(`the web address is only ${gr.domain_age_days} days old`);
  }
  const svc = (gr.service_queries ?? null) && gr.service_queries.filter((s) => !s.branded);
  if (svc && svc.length) {
    const hits = svc.filter((s) => s.position != null);
    if (hits.length === 0)
      bits.push(`tested against ${svc.length} non-branded searches (business name removed), it appears for none (never name or guess the phrases tested)`);
    else
      bits.push(`it appears in ${hits.length} of ${svc.length} non-branded searches (business name removed), though not always prominently (never name or guess the phrases tested)`);
  } else if (svc) {
    bits.push("no non-branded search phrase could be derived from the site's own copy, which means strangers have nothing to find it by");
  }
  return bits.join("; ") + ".";
}

// Observed Google presence, 0-100, deterministic and tier-independent:
// 50 points for how much of the site Google lists, 50 for being found by name.
export function presenceScore(gr, builtPages) {
  if (!gr || gr.pending || gr.error || typeof gr.indexed_pages !== "number") return null;
  // The count is a floor (we see at most one page of results), so measure
  // against what is knowable: full page = fully healthy; small sites exactly.
  // Scale v0.15: non-branded discoverability carries the weight. Being found
  // by your own name proves little; being found by strangers is visibility.
  const built = Math.max(builtPages ?? 1, 1);
  const base = Math.min(built, 10);
  const indexRatio = Math.min(1, gr.indexed_pages / base);
  const indexPts = Math.round(indexRatio * 30);
  const namePts = gr.brand_position != null
    ? (gr.brand_position <= 3 ? 20 : 14)
    : 0;
  const svcAll = gr.service_queries ?? null;
  const svc = svcAll ? svcAll.filter((s) => !s.branded) : null;
  const hits = svc ? svc.filter((s) => s.position != null).length : null;
  const svcPts = hits == null ? (svcAll ? 0 : null) : svc.length === 0 ? 0 : hits >= 2 ? 50 : hits === 1 ? 35 : 0;
  const score = svcPts == null
    ? Math.round(((indexPts + namePts) / 50) * 100)
    : Math.min(100, indexPts + namePts + svcPts);
  return {
    score,
    components: {
      indexed: `${gr.indexed_at_least ? "10+" : gr.indexed_pages} pages listed (checked against ${base}) -> ${indexPts}/30`,
      own_name: gr.brand_position != null ? `found #${gr.brand_position} -> ${namePts}/20` : "not found in top 10 -> 0/20",
      non_branded: svcAll == null
        ? "not measured"
        : svc.length === 0
          ? (gr.terms_source === "manual"
              ? "every term provided contains the brand name -> 0/50 (branded terms are shown but never scored)"
              : "no non-branded phrase derivable from the site's copy -> 0/50 (the copy only talks about the brand)")
          : `found for ${hits} of ${svc.length} non-branded searches${gr.terms_source === "manual" ? " (your terms)" : ""} -> ${svcPts}/50`,
    },
  };
}

// Crawlable -> Indexable -> Indexed -> Found by name -> Found for searches.
// True only when the "*" group itself carries "Disallow: /" - a block on
// some OTHER bot (PetalBot, GPTBot...) must never read as blocking Google.
export function robotsDisallowsAll(robots) {
  let stars = false, collecting = false;
  for (const raw of (robots ?? "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const ua = line.match(/^user-agent:\s*(.+)$/i);
    if (ua) {
      if (!collecting) stars = false;
      collecting = true;
      if (ua[1].trim() === "*") stars = true;
      continue;
    }
    if (!line) continue;
    collecting = false;
    if (stars && /^disallow:\s*\/$/i.test(line)) return true;
  }
  return false;
}

export function funnelFrom(ctx, gr) {
  const robots = ctx.probes?.robots?.body ?? "";
  const blockedAll = robotsDisallowsAll(robots);
  const homeCode = ctx.probes?.home?.code ?? 0;
  const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(ctx.probes?.home?.body ?? "");
  const st = (v) => (v === null ? "unknown" : v ? "pass" : "fail");
  const svc = gr?.service_queries ?? null;
  return [
    { key: "crawlable", label: "Crawlable", state: st(!(blockedAll || homeCode >= 400 || homeCode === 0)) },
    { key: "indexable", label: "Indexable", state: st(!noindex) },
    { key: "indexed", label: "Indexed", state: gr?.pending || gr?.error ? "unknown" : st((gr?.indexed_pages ?? 0) > 0) },
    { key: "name", label: "Found by name", state: gr?.pending || gr?.error ? "unknown" : st(gr?.brand_found === true) },
    { key: "searches", label: "Found for searches", state: !svc || gr?.pending || gr?.error ? "unknown" : st(svc.some((s) => s.position != null)) },
  ];
}
