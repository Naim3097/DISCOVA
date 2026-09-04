// DISCOVA authority-lite — honest, labelled approximations for the Authority
// category, which otherwise sits pending. Two sources:
//  - Open PageRank (free API, OPR_API_KEY): a public domain-strength estimate.
//  - External brand mentions: the brand searched on Google minus the site itself.
// Both are approximations and say so; without the key the category stays pending.

export async function authorityLite(ctx, { search, log }) {
  const domain = ctx.domain.replace(/^www\./, "");
  const oprKey = process.env.OPR_API_KEY;
  const out = { findings: [] };

  if (oprKey) {
    try {
      const res = await fetch(
        `https://openpagerank.com/api/v1.0/getPageRank?domains[]=${encodeURIComponent(domain)}`,
        { headers: { "API-OPR": oprKey }, signal: AbortSignal.timeout(12_000) }
      );
      if (res.ok) {
        const j = await res.json();
        const rank = Number(j.response?.[0]?.page_rank_decimal ?? NaN);
        if (!Number.isNaN(rank)) {
          out.opr = rank; // 0-10 public scale
          out.score = rank >= 4 ? 90 : rank >= 3 ? 75 : rank >= 2 ? 60 : rank >= 1 ? 40 : 25;
          log(`authority: Open PageRank ${rank}/10 -> category ${out.score}`);
          if (rank < 2)
            out.findings.push({
              check_id: "auth-weak-domain-strength",
              category: "Authority & Off-Page", severity: rank < 1 ? "high" : "medium",
              title: "The domain carries little weight on the wider web",
              evidence: `Open PageRank ${rank}/10 for ${domain} (public estimate of link strength)`,
              evidence_label: "likely", confidence: 0.6, verification: "none",
              reach: "high", effort: "high",
              internal_detail: `OPR ${rank}/10. Build real citations and links: directories the business already appears in, suppliers, associations, local press.`,
              client_summary: "Very little on the wider web points at this site, and Google largely ranks by who is pointed at.",
            });
        }
      }
    } catch (e) {
      log("authority: OPR unavailable - " + e.message);
    }
  }

  if (search) {
    try {
      await new Promise((res) => setTimeout(res, 600)); // pace behind the reality queries
      const title = (ctx.dom?.title ?? "").split(/[|\-–—·:]/)[0].trim();
      const brand = title.length >= 3 && title.length <= 60 ? title : domain.split(".")[0];
      const res = await search(`"${brand}" -site:${domain}`);
      const mentions = res.items.filter((i) => {
        try { return !new URL(i.link).hostname.replace(/^www\./, "").endsWith(domain); } catch { return false; }
      }).length;
      out.mentions = mentions;
      if (mentions === 0)
        out.findings.push({
          check_id: "auth-no-external-mentions",
          category: "Authority & Off-Page", severity: "medium",
          title: "No other website mentions the business",
          evidence: `A Google search for "${brand}" excluding the site itself surfaced no third-party pages in the top results`,
          evidence_label: "likely", confidence: 0.7, verification: "none",
          reach: "high", effort: "medium",
          internal_detail: "Zero external mentions found. Start with the free tier: directory profiles, GBP, association listings, supplier pages - each is a citation Google can count.",
          client_summary: "Nowhere else on the web vouches for the business by name, so Google has only the site's own word for it.",
        });
    } catch (e) {
      log("authority: mention check failed - " + e.message);
    }
  }

  return out;
}
