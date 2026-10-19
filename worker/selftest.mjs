// DISCOVA self-test — executes the KEYED code paths with a stubbed search
// engine, so a refactor can never again ship a ReferenceError that only
// surfaces in production. Run before every push:  node selftest.mjs
// Exits non-zero on any failure.

import { googleReality, presenceScore, funnelFrom, deriveBrand, deriveServiceQueries, robotsDisallowsAll, realityForWriter } from "./reality.js";
import { authorityLite } from "./authority.js";
import { diagnose } from "./diagnose.js";

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log((cond ? "PASS" : "FAIL"), name, extra);
  if (!cond) failures++;
};

const DOMAIN = "drkartini.net";
const ctx = {
  domain: "www.drkartini.net",
  dom: {
    title: "Home | DrKartini.net — Klinik Pakar Kulit Kuala Lumpur",
    h1s: ["Rawatan Kulit Profesional"],
  },
  probes: {
    robots: { body: "User-agent: *\nAllow: /\n\nUser-agent: PetalBot\nDisallow: /\n" },
    home: { code: 200, body: "<html><head><title>x</title></head></html>" },
    sitemap: { count: 12, urls: [] },
  },
};

// Deterministic stub: full page of own results for site:, brand at #2,
// one service query hits at #5, mentions return externals.
const stubSearch = async (q) => {
  const own = (n) => Array.from({ length: n }, (_, i) => ({ link: `https://www.${DOMAIN}/p${i}` }));
  const ext = (n) => Array.from({ length: n }, (_, i) => ({ link: `https://other${i}.com/x` }));
  if (q.startsWith("site:")) return { total: 10, page_full: true, items: own(10) };
  if (q.includes("-site:")) return { total: 5, page_full: false, items: ext(5) };
  if (q.startsWith('"')) return { total: 8, page_full: false, items: [...ext(1), ...own(1), ...ext(6)] };
  if (q === "Rawatan Kulit Profesional") return { total: 9, page_full: false, items: [...ext(4), ...own(1), ...ext(4)] };
  return { total: 6, page_full: false, items: ext(6) };
};

// ---- full keyed googleReality ----
const gr = await googleReality(ctx, { log: () => {}, searchOverride: stubSearch });
check("googleReality no error", !gr.error, gr.error ?? "");
check("indexed 10+", gr.indexed_pages === 10 && gr.indexed_at_least === true);
check("brand derived correctly", gr.brand_query === "DrKartini.net", JSON.stringify(gr.brand_query));
check("brand found #2", gr.brand_found === true && gr.brand_position === 2);
check("service queries ran", Array.isArray(gr.service_queries) && gr.service_queries.length >= 1);
const hits = (gr.service_queries ?? []).filter((s) => s.position != null).length;
check("one service hit", hits === 1, `hits=${hits}`);

// ---- presence on that result ----
const pres = presenceScore(gr, 12);
check("presence computed", pres && typeof pres.score === "number", JSON.stringify(pres?.score));
check("presence = 30+20+35 (non-branded weighted)", pres?.score === 85, `got ${pres?.score}`);
const bluecab = deriveServiceQueries({
  domain: "bluecabmalaysiavip.com",
  dom: { title: "BlueCab Malaysia VIP — Travel in Comfort with BlueCab Malaysia VIP", h1s: ["Travel in Comfort with BlueCab Malaysia VIP"] },
});
check("brand stripped from derived queries", bluecab.every((q) => !/bluecab|vip/i.test(q)), JSON.stringify(bluecab));

// manual terms: branded ones tested but excluded from scoring
const grM = await googleReality(ctx, {
  log: () => {}, searchOverride: stubSearch,
  manualTerms: ["best skin clinic selangor", "DrKartini treatments"],
});
check("manual terms used", grM.terms_source === "manual" && grM.service_queries.length === 2);
check("branded manual term flagged", grM.service_queries.some((s) => s.branded === true), JSON.stringify(grM.service_queries.map((s) => ({ q: s.q, branded: !!s.branded }))));
const presM = presenceScore(grM, 12);
check("branded term not scored", String(presM.components.non_branded).includes("of 1"), presM.components.non_branded);

// ---- funnel ----
const fun = funnelFrom(ctx, gr);
check("funnel crawlable pass (PetalBot ignored)", fun.find((s) => s.key === "crawlable")?.state === "pass");
check("funnel name pass", fun.find((s) => s.key === "name")?.state === "pass");

// ---- diagnosis ----
const diag = diagnose(gr, []);
check("diagnosis has client line", typeof diag.client === "string" && diag.client.length > 10, diag.code);
check("diagnosis sensible", ["weak_rankings", "visible"].includes(diag.code), diag.code);

// ---- writer line (must not name queries) ----
const wl = realityForWriter(gr) ?? "";
check("writer line exists", wl.length > 20);
check("writer line names no query", !wl.includes("Rawatan"), wl.slice(0, 80));

// ---- authority keyed path ----
const auth = await authorityLite(ctx, { search: stubSearch, log: () => {} });
check("authority mentions counted", typeof auth.mentions === "number", `mentions=${auth.mentions}`);

// ---- robots parser table ----
check("robots: petalbot block ignored", robotsDisallowsAll(ctx.probes.robots.body) === false);
check("robots: true block-all caught", robotsDisallowsAll("User-agent: *\nDisallow: /") === true);

// ---- error path stays honest ----
const bad = await googleReality(ctx, { log: () => {}, searchOverride: async () => { throw new Error("boom"); } });
check("search failure -> error recorded, no throw", typeof bad.error === "string" && bad.error.includes("boom"));

console.log(failures === 0 ? "\nSELF-TEST: ALL PASS" : `\nSELF-TEST: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
