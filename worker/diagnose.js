// DISCOVA visibility diagnosis — names the most likely REASON behind what the
// Google-reality check observed, from evidence already gathered. Deterministic
// ordered rules; the first that matches wins. Never guesses beyond its inputs.

const DIAGNOSES = {
  pending: {
    label: "Visibility not yet measured",
    client: "Visibility measurement is still in progress.",
    detail: "Search checks are pending; the diagnosis arrives with them.",
  },
  new_site_not_indexed: {
    label: "Too new for Google",
    client: "The website is too new for Google to show it yet, so right now no search can bring anyone here.",
    detail: "The site is not in Google's index and the address is only weeks old. Google likely has not discovered it yet: no submission, and nothing on the web links to it.",
  },
  blocked_from_index: {
    label: "Blocking its own indexing",
    client: "Choices on the website itself are keeping it out of Google's listings, so searches cannot bring customers here.",
    detail: "The site is not in Google's index and the audit found technical signals that block or confuse crawlers. Fix those first; visibility cannot start until they are gone.",
  },
  not_indexed: {
    label: "Invisible to Google",
    client: "Google does not list this website at all, so no search of any kind currently brings customers here.",
    detail: "The site is not in Google's index despite being technically reachable. The usual cause is that nothing on the web links to it, so crawlers have no path in.",
  },
  outranked_for_name: {
    label: "Loses even its own name",
    client: "Even people searching the business by name are shown other websites first.",
    detail: "The site is indexed, but searching the business's own name surfaces other sites first. Its authority and identity signals are weaker than pages ABOUT it.",
  },
  not_targeting_searches: {
    label: "Findable by name only",
    client: "Customers who already know the business can find it; customers looking for what it sells cannot.",
    detail: "People who know the business can find it; nobody else can. The pages do not carry the words real customers search for, so there is nothing for Google to match.",
  },
  too_thin_to_rank: {
    label: "Too thin to compete",
    client: "The website appears in the right kind of searches but loses them to competitors with more to say.",
    detail: "The site targets the right kind of searches but says too little; deeper pages elsewhere win them. Depth, proof and supporting pages are the lever.",
  },
  weak_rankings: {
    label: "Visible but outgunned",
    client: "The website enters real customer searches but rarely near the top, where the clicks actually happen.",
    detail: "The site appears for some real searches but not prominently. It is in the game; authority and content depth decide how high it climbs.",
  },
  visible: {
    label: "Genuinely visible",
    client: "The website is genuinely findable, by name and by what it sells.",
    detail: "Indexed in healthy numbers, first for its own name, and appearing for real customer searches. Visibility is not this site's problem.",
  },
};

export function diagnose(gr, findings) {
  const has = (id) => findings.some((f) => f.check_id === id);
  const svc = gr?.service_queries ?? null;
  const svcHits = svc ? svc.filter((s) => s.position != null).length : null;

  let code;
  if (!gr || gr.pending || gr.error) code = "pending";
  else if (gr.indexed_pages === 0) {
    if ((gr.domain_age_days ?? 9999) < 90) code = "new_site_not_indexed";
    else if (has("tech-sitemap") || has("tech-robots") || has("tech-nested-html") || has("tech-rented-address")) code = "blocked_from_index";
    else code = "not_indexed";
  } else if (gr.brand_found === false) code = "outranked_for_name";
  else if (svcHits === 0 && (has("kw-brand-only-title") || has("kw-generic-headings") || has("onpage-single-page") || has("kw-few-indexable-pages") || (svc && svc.length === 0)))
    code = "not_targeting_searches";
  else if (svcHits === 0 && (has("onpage-thin") || has("content-depth-modest") || has("content-no-supporting-pages")))
    code = "too_thin_to_rank";
  else if (svcHits === 0) code = "not_targeting_searches";
  else if (svc && svcHits < svc.length) code = "weak_rankings";
  else code = "visible";

  return { code, ...DIAGNOSES[code] };
}
