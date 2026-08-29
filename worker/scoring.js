// DISCOVA scoring engine — implements framework §6–§7 exactly.
// Fixed scoring core: same maths at every tier (locked decision P3).

export const CATS = {
  T: "Technical SEO",
  O: "On-Page SEO",
  C: "Content & Topical Authority",
  K: "Keyword & Search Opportunity",
  S: "SERP Visibility",
  L: "Local SEO",
  A: "Authority & Off-Page",
  U: "SEO UX & Conversion",
  D: "Design & Brand",
};

// v2.2 category weights
const WEIGHTS = {
  [CATS.T]: 18, [CATS.O]: 13, [CATS.C]: 18, [CATS.K]: 13,
  [CATS.S]: 9, [CATS.L]: 5, [CATS.A]: 9, [CATS.U]: 5, [CATS.D]: 10,
};

const DEDUCTION = { critical: -25, high: -15, medium: -8, low: -3 };

const BANDS = [
  [85, "Excellent"], [70, "Good"], [55, "Fair"], [35, "Developing"], [0, "Critical"],
];

const STATUS = [
  [75, "Good"], [55, "Fair"], [35, "Needs improvement"], [0, "Needs attention"],
];

export function deductionFor(severity) {
  return DEDUCTION[severity] ?? 0;
}

function bandFor(score, table) {
  for (const [min, label] of table) if (score >= min) return label;
  return table[table.length - 1][1];
}

// findings: [{category, severity, score_impact, title, client_summary, evidence_label}]
// pendingCats: categories not yet assessable (e.g. Design until stage 5) —
// their weight is redistributed proportionally per framework §6.3.
export function scoreRun(findings, { pendingCats = [] } = {}) {
  const catScores = {};
  for (const cat of Object.values(CATS)) {
    if (pendingCats.includes(cat)) continue;
    let s = 100;
    for (const f of findings) {
      if (f.category === cat && f.score_impact) s += f.score_impact;
    }
    catScores[cat] = Math.max(0, Math.round(s));
  }

  const activeWeight = Object.values(CATS)
    .filter((c) => !pendingCats.includes(c))
    .reduce((sum, c) => sum + WEIGHTS[c], 0);

  let overall = 0;
  for (const [cat, s] of Object.entries(catScores)) {
    overall += s * (WEIGHTS[cat] / activeWeight);
  }
  overall = Math.round(overall);

  return { catScores, overall, band: bandFor(overall, BANDS) };
}

// Roll the 9 internal categories up to the client-facing areas (framework §7),
// weights preserved inside each area.
const AREA_MAP = [
  { key: "google_visibility", label: "Google Visibility", cats: [CATS.K, CATS.S, CATS.A] },
  { key: "website_content", label: "Website Content", cats: [CATS.C, CATS.O] },
  { key: "user_experience", label: "User Experience", cats: [CATS.U] },
  { key: "technical_foundation", label: "Technical Foundation", cats: [CATS.T] },
  { key: "local_search", label: "Local Search", cats: [CATS.L] },
  { key: "design_brand", label: "Design & Brand", cats: [CATS.D] },
];

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function rollUp(catScores, findings, { pendingCats = [] } = {}) {
  const areas = [];
  for (const area of AREA_MAP) {
    const active = area.cats.filter((c) => !pendingCats.includes(c));
    if (active.length === 0) continue; // area entirely pending — omitted, noted on run
    const w = active.reduce((s, c) => s + WEIGHTS[c], 0);
    const score = Math.round(active.reduce((s, c) => s + catScores[c] * (WEIGHTS[c] / w), 0));
    const worst = findings
      .filter((f) => active.includes(f.category) && f.severity && f.score_impact)
      .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9))[0];
    areas.push({
      key: area.key,
      label: area.label,
      score,
      status: bandFor(score, STATUS),
      note: worst ? `${worst.title}.` : "No significant issues found in the checks run.",
    });
  }
  return areas;
}
