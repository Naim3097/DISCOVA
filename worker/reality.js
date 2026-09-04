// DISCOVA Google-reality check — observed presence, kept beside the score,
// never inside it. The audit score means "how ready the site is"; this module
// answers "can anyone actually find it": pages Google lists (official Custom
// Search API), whether the site surfaces for its own name, and domain age
// (registry RDAP, no key). Missing keys or registry silence are reported as
// exactly that. Nothing here moves the Visibility Score.

const CSE = "https://www.googleapis.com/customsearch/v1";

// Primary index source: serper.dev (real Google results; Google deprecated
// whole-web Programmable Search Engines, closing the official free route).
// gl=my so results match what Malaysian searchers actually see.
async function serperQuery(q, key) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "X-API-KEY": key, "content-type": "application/json" },
    body: JSON.stringify({ q, gl: "my", num: 10 }),
  });
  if (!res.ok) throw new Error(`serper ${res.status}`);
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

export async function googleReality(ctx, { log }) {
  const domain = ctx.domain.replace(/^www\./, "");
  const serper = process.env.SERPER_API_KEY;
  const key = process.env.GOOGLE_CSE_KEY, cx = process.env.GOOGLE_CSE_CX;
  const search = serper
    ? (q) => serperQuery(q, serper)
    : key && cx
      ? (q) => cseAdapter(q, key, cx)
      : null;
  const out = { checked_at: new Date().toISOString().slice(0, 10) };

  const age = await domainAgeDays(ctx.domain);
  if (age) { out.domain_registered = age.registered; out.domain_age_days = age.age_days; }

  if (!search) {
    out.pending = true;
    out.note = "Google index data arrives when SERPER_API_KEY is set";
    log("google reality: index check pending (no search key)");
    return out;
  }
  out.source = serper ? "serper.dev (Google results)" : "Google Custom Search";

  try {
    const site = await search(`site:${domain}`);
    // Google substitutes general results when a site: query finds little -
    // only URLs actually on this domain count as indexed pages.
    const own = site.items.filter((i) => {
      try {
        const h = new URL(i.link).hostname.replace(/^www./, "");
        return h === domain || h.endsWith("." + domain);
      } catch { return false; }
    });
    out.indexed_pages = own.length;
    out.indexed_at_least = own.length >= 10; // full page of OWN results = "10+", a floor

    // Brand = the human name the site gives itself, falling back to the domain label.
    const title = (ctx.dom?.title ?? "").split(/[|\-–—·:]/)[0].trim();
    const brand = title.length >= 3 && title.length <= 60 ? title : domain.split(".")[0];
    out.brand_query = brand;
    const bres = await search(`"${brand}"`);
    const items = bres.items;
    const pos = items.findIndex((i) => {
      try { return new URL(i.link).hostname.replace(/^www\./, "") === domain; } catch { return false; }
    });
    out.brand_found = pos !== -1;
    if (pos !== -1) out.brand_position = pos + 1;

    out.invisible = out.indexed_pages === 0;
    out.outranked_for_own_name = !out.invisible && !out.brand_found;
    log(`google reality: ${out.indexed_pages} pages indexed, brand "${brand}" ${out.brand_found ? "found #" + out.brand_position : "NOT found in top 10"}`);
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
  return bits.join("; ") + ".";
}

// Observed Google presence, 0-100, deterministic and tier-independent:
// 50 points for how much of the site Google lists, 50 for being found by name.
export function presenceScore(gr, builtPages) {
  if (!gr || gr.pending || gr.error || typeof gr.indexed_pages !== "number") return null;
  // The count is a floor (we see at most one page of results), so measure
  // against what is knowable: full page = fully healthy; small sites exactly.
  const built = Math.max(builtPages ?? 1, 1);
  const base = Math.min(built, 10);
  const indexRatio = Math.min(1, gr.indexed_pages / base);
  const indexPts = Math.round(indexRatio * 50);
  const namePts = gr.brand_position != null
    ? (gr.brand_position <= 3 ? 50 : 35)
    : 0;
  return {
    score: Math.min(100, indexPts + namePts),
    components: {
      indexed: `${gr.indexed_at_least ? "10+" : gr.indexed_pages} pages listed (checked against ${base}) -> ${indexPts}/50`,
      own_name: gr.brand_position != null ? `found #${gr.brand_position} -> ${namePts}/50` : "not found in top 10 -> 0/50",
    },
  };
}
