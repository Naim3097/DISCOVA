// DISCOVA Google-reality check — observed presence, kept beside the score,
// never inside it. The audit score means "how ready the site is"; this module
// answers "can anyone actually find it": pages Google lists (official Custom
// Search API), whether the site surfaces for its own name, and domain age
// (registry RDAP, no key). Missing keys or registry silence are reported as
// exactly that. Nothing here moves the Visibility Score.

const CSE = "https://www.googleapis.com/customsearch/v1";

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
  const key = process.env.GOOGLE_CSE_KEY, cx = process.env.GOOGLE_CSE_CX;
  const out = { checked_at: new Date().toISOString().slice(0, 10) };

  const age = await domainAgeDays(ctx.domain);
  if (age) { out.domain_registered = age.registered; out.domain_age_days = age.age_days; }

  if (!key || !cx) {
    out.pending = true;
    out.note = "Google index data arrives when GOOGLE_CSE_KEY and GOOGLE_CSE_CX are set";
    log("google reality: index check pending (no CSE key)");
    return out;
  }

  try {
    const site = await cseQuery(`site:${domain}`, key, cx);
    out.indexed_pages = Number(site.searchInformation?.totalResults ?? 0);

    // Brand = the human name the site gives itself, falling back to the domain label.
    const title = (ctx.dom?.title ?? "").split(/[|\-–—·:]/)[0].trim();
    const brand = title.length >= 3 && title.length <= 60 ? title : domain.split(".")[0];
    out.brand_query = brand;
    const bres = await cseQuery(`"${brand}"`, key, cx);
    const items = bres.items ?? [];
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
  else bits.push(`Google lists ${gr.indexed_pages} of this site's pages`);
  if (gr.brand_found === false) bits.push("a search for the business's own name does not surface this site in the top ten");
  else if (gr.brand_position) bits.push(`the site appears at position ${gr.brand_position} for its own name`);
  if (gr.domain_age_days != null && gr.domain_age_days < 180) {
    bits.push(`the web address is only ${gr.domain_age_days} days old`);
  }
  return bits.join("; ") + ".";
}
