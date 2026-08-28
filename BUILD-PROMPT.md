# DISCOVA — Build Prompt

**Product:** DISCOVA — Website Visibility Intelligence Engine
**Brand line:** DISCOVA · powered by lean.X digital
**Version:** 1.0 — 28 August 2026
**Status:** All build decisions are locked (§1). The companion documents in this folder are the specification — implement them, do not re-derive the methodology.

---

## 0. What DISCOVA is

An internal tool for the lean.X digital team: enter a domain, choose a depth, and receive a scored, verified, professional website-visibility analysis plus a client-ready PDF within minutes.

Fourteen manual audits preceded this build (MY.Z Solution through KATMB). DISCOVA automates that exact methodology — the same checks, the same scoring, the same two-tier output, the same report design. It is not an SEO checker; it is the productisation of an audit practice that already wins clients.

Two equal success criteria, neither sacrificed for the other:
- **Product** — it must actually work. Real data only, verified before published.
- **Experience** — it must feel exceptional. Beautiful real software, not beautiful fake SaaS.

The builder works stage by stage (§12): explain what and why, implement, explain how to test, list any keys needed, then move on. The maintainer is a frontend-focused developer — explain backend decisions in practical terms ("the analysis takes minutes, so we create a job and process it in the background"), never in jargon.

---

## 1. Locked decisions

| # | Area | Decision |
|---|---|---|
| P1 | Tier 1 scope | **Tier 1 = the full current audit** — key pages, complete check register, design review with image vision, verification pass, client PDF. Not a stripped-down triage. |
| P2 | Users | **Internal team only** for v1. No client logins. Clients only ever receive the PDF. |
| P3 | Scoring | **One fixed scoring core at every tier.** Deeper tiers add findings, patterns and priorities below the scoring line — the score never changes with depth. |
| P4 | Tier boundary | Tier 1 = key pages, full register · Tier 2 = the whole site, no API keys · Tier 3 = external data + strategy. |
| P5 | Outputs | Client PDF from every tier. Internal report from Tier 2 up. 30/60/90 strategic plan Tier 3 only, internal only. |
| P6 | Tier names | **Audit · Investigation · Intelligence** (see / understand / decide). |
| P7 | Language | English only for v1. BM is a planned fast-follow — keep the writer layer swappable. |
| P8 | Competitors | User supplies up to 3 competitor URLs on the Intelligence start screen. Auto-discovery deferred (needs geo SERP API). |
| P9 | AI visibility | Findings section only. Never a scored category. Never promise "you will appear in ChatGPT." |
| M1 | Priority model | Framework v2.2 model: `(Impact × Opportunity × Reach) ÷ Effort × Confidence`. One model everywhere. |
| C1 | Stack | Next.js (App Router) on Vercel · Node + Playwright worker on Railway · Supabase (Postgres, Auth, Storage). |
| C2 | Queue | **pg-boss on the Supabase Postgres.** A jobs table the worker polls — no extra queue service to run or pay for. |
| C3 | AI | **Anthropic Claude API** for both AI touchpoints: the image-vision pass and the client-safe writer. One provider, one key. |
| C4 | Name | Platform: **DISCOVA**. Reports and UI footer: "DISCOVA · powered by lean.X digital". Domain: **still open** — deploy on vercel.app until chosen. |
| D1 | Budget | v1 external spend ≈ RM0 beyond the Claude key (cents per audit). PSI key is free — create at stage 9. GSC, SERP and backlink providers deferred; those metrics render as *requires external data*. |
| E1 | Crawl caps | Audit ~10 key pages · Investigation 50–200 pages sampled by template · Intelligence same + external calls. Politeness: max 2 concurrent requests per host, 500ms delay, 15s timeouts. |
| E2 | Crawler identity | UA `DiscovaBot/1.0 (+https://DOMAIN/bot)`. Respects robots.txt for its own crawling while still *reporting* what robots.txt contains. |
| E3 | Retention | Evidence artifacts (HTML snapshots, screenshots) kept 90 days. Runs, findings and scores kept indefinitely. |

---

## 2. Source-of-truth documents (in this folder)

| File | What it is |
|---|---|
| `SEO_AUDIT_FRAMEWORK.md` (v2.2) | **The methodology spec.** The 160-check register, category weights, deduction scoring, N/A redistribution, the 6-area client roll-up, health bands, the 24 design criteria with half-credit, disclosure rules, report structure, and the §16 deliverable design standard. |
| `templates/report-print-head.html` | The client PDF letterhead + print styles used on all fourteen real reports. Port as-is. |
| `templates/report-web-styles.css` | The web/report-view variant of the same design. |
| `templates/example-report.html` | A complete real client report (KATMB) — the target output, end to end. |
| `assets/leanx-logo.png` | Embed as base64 in PDFs (the templates already do this). |

**Rule:** where this prompt and the framework overlap, the framework wins on methodology (checks, scores, wording rules) and this prompt wins on engineering. Never invent a scoring system, a category, or a disclosure rule — they all exist.

---

## 3. Architecture

**Why this shape:** an analysis takes 2–15 minutes. A browser request cannot stay open that long, so the flow is: the app creates an analysis job → a background worker processes it → the frontend shows live progress as each module completes.

```text
User (team login)
   │
   ▼
Next.js app on Vercel ──── creates run row + job ────▶ Supabase Postgres
   │  (dashboard, run view,                              (runs, findings,
   │   PDF download)                                      pages, jobs via pg-boss)
   │                                                          ▲
   │                                                          │ polls jobs,
   ▼                                                          │ writes results
Supabase Storage ◀── evidence artifacts ──── Playwright worker on Railway
(screenshots, HTML)                          (crawl → check → verify → score)
                                                              │
                                                              ▼
                                              Claude API (vision + writer)
                                              PSI API (free key, stage 9)
```

- **Vercel** runs the interface and light API routes only. Nothing long-running.
- **Railway** runs one always-on Node service with Playwright installed. This is the only "server" to think about, and it deploys from a push exactly like Vercel does.
- **Supabase** is the database (Postgres), the team login (Auth), and the file store (Storage). Already familiar from previous lean.X projects.
- **pg-boss** is a job queue that lives inside Postgres itself. In practice: a table of jobs; the worker takes the next one, updates progress, marks it done. Nothing extra to host, and jobs survive restarts.
- **Claude API** is called in exactly two places (§7, §9): judging images against the design criteria, and writing the client-safe summaries. Everything else is deterministic code.

**Environment variables**

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | app → Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + Railway | server-side DB/storage access |
| `DATABASE_URL` | Railway | worker + pg-boss direct Postgres connection (session mode) |
| `ANTHROPIC_API_KEY` | Railway | vision + writer |
| `PSI_API_KEY` | Railway | PageSpeed Insights (added at stage 9) |

Running cost expectation: Vercel free tier · Railway ~US$5–10/mo · Supabase free tier · Claude API cents per audit · PSI free.

---

## 4. Data model

Define this first; the UI is built around it (frontend-first, §12). Everything below is real data the engine returns — no fields that exist to make the UI look complete.

**`runs`** — one row per analysis.

```text
run
├── id, domain, started_at, finished_at
├── tier                audit | investigation | intelligence
├── framework_version   "2.2" — stamped so historical scores stay interpretable
├── status              queued | crawling | checking | verifying | scoring | writing | done | failed | partial
├── scores              jsonb: 9 category scores, 6-area roll-up, overall, band, redistribution notes
└── competitor_urls     text[] (intelligence tier, user-supplied)
```

**`findings`** — the atom of the whole product. One consistent structure powers the dashboard, detail views, priorities, history, and both PDFs.

```text
finding
├── run_id
├── check_id          which register check produced it (framework §3) — e.g. "3.1-sitemap-exists"
├── category          one of the 9 internal categories
├── severity          critical | high | medium | low
├── title
├── evidence          the observed value, URL, header, or excerpt
├── evidence_label    verified | likely | requires_external_data | not_testable
├── verification      raw_html | rendered_dom | runtime_js | image_review | none
├── confidence        1.0 verified · 0.7 likely · 0.4 inferred — below 0.4 is never published
├── reach             high (site-wide/template) | medium (section) | low (single page)
├── artifacts         paths in Storage: screenshot crops, header dumps, code excerpts
├── internal_detail   the developer-ready fix — NEVER rendered in client outputs
├── client_summary    business-consequence wording — ALL the client PDF may use
├── effort            quick_win | low | medium | high
├── score_impact      the deduction this finding applied (or 0 if below the scoring line)
└── status            open | fixed | dismissed
```

**`pages`** — one row per fetched URL: url, template_cluster, status code, refs to raw + rendered snapshots in Storage.

Rules baked into the model:
- `not_testable` is a first-class outcome, not an error. It is how the product stays honest about CWV field data, backlinks, and geo-SERP checks until those keys exist.
- The same `scores` object feeds every output. The client PDF and the internal report can never disagree.
- `internal_detail` vs `client_summary` is the two-tier disclosure model enforced at the schema level. The PDF generator physically cannot access `internal_detail`.

---

## 5. One engine, three depth profiles

There is **one** set of analyzer modules. A tier is a configuration profile that sets each module's depth — never three parallel engines.

```text
/analyzers                     AUDIT            INVESTIGATION       INTELLIGENCE
├── crawl                      ~10 key pages    + site-wide,        same as
│                                               template-sampled     Investigation
│                                               (50–200 pages)
├── technical                  full register    + pattern layer     same
├── onpage / content           full register    + patterns, thin/   + gaps &
│                                               duplicate signals    cannibalisation
├── design (24 criteria)       full, incl.      same                same
│                              image vision
├── performance                own measures     + sampled across    + CWV field data
│                              (TTFB, weight,   templates            (PSI/CrUX key)
│                              requests)
├── local / serp-eligibility   full register    same                same
├── competitors                —                —                   up to 3 user URLs:
│                                                                   sitemap + structure
│                                                                   comparison (no key)
├── search-data (GSC)          —                —                   deferred to v2
├── authority (backlinks)      labelled requires_external_data at every tier
└── synthesis                  score, quick     + patterns          + root-cause chains,
                               wins, client     ("17 of 62 pages,    priority model,
                               PDF              same template"),     30/60/90 plan
                                                internal report      (internal)
```

**Audit** is the productised manual method — the full register on the homepage plus key pages (services, about, contact, plus sitemap-listed top pages up to ~10), the complete design review, verification, scoring, and the client PDF. Target: 2–3 minutes.

**Investigation** adds the site as a system: crawl the whole site within caps, cluster URLs by template pattern, sample up to 5 pages per cluster, and detect patterns — "24 pages missing metadata, 21 from the same template" is the target output shape. Target: ~5 minutes.

**Intelligence** adds the outside world and the strategy layer: PSI/CrUX data, user-supplied competitor comparison (the 1-page-vs-70 chart from the manual audits — no API needed), root-cause reasoning (symptom vs cause), the v2.2 priority model, and the 30/60/90 plan. Target: 10–15 minutes.

**Depth selector UI** — three plain rows, instrument-like. No feature cards, no emoji, no illustrations, no "AI-powered" language:

> **Audit** — The complete lean.X audit. Key pages, full check register, design review, client-ready PDF. ~3 min
> **Investigation** — The whole site. Crawls every page, finds the patterns and template-level causes behind the findings. ~5 min
> **Intelligence** — Adds the outside world. Performance field data, competitors you name, prioritised actions and a 30/60/90 plan. ~15 min

**Score comparability (locked P3):** the Visibility Score is always computed from the same fixed core — the framework register applied to the key pages. Investigation and Intelligence add findings *below the scoring line* (`score_impact: 0`). A site audited at any tier, any week, produces comparable numbers.

---

## 6. The verification stage — the product's moat

Pipeline per finding: **detect → verify → publish.** Nothing reaches output unverified. Raw detection lies; these are real false positives from the manual audits that verification caught:

| Naive detection | Runtime truth |
|---|---|
| DRVSAFE: five `href="#"` buy buttons "broken" | JavaScript rewrites them into pre-filled WhatsApp links on load |
| KATMB: "34 dead links" | Dropdown toggles and menu controls — functional UI |
| KATMB: "46 carousels" | Sub-elements of 4 actual carousels |
| KATMB: "7 broken images (0×0)" | Lazy-loading; all load correctly when forced |
| Cipta Karya: "0 headings" (suspicious on Wix) | Re-checked at readyState complete + after scroll — genuinely true, then published |

Verify rules by finding type (extend as modules grow):
- `href="#"` links → check `onclick`, `data-toggle` / `data-bs-toggle`, and inline script references before calling them dead.
- Images → force `loading=eager`, scroll the page, wait, then measure `naturalWidth`.
- Titles/meta/headings → capture **both** raw HTML and rendered DOM and diff them; some findings only exist in the difference (MRL's title changes after JS runs; MY.Z's nested document).
- Counts (carousels, sliders) → count root components, not descendants.
- Every check that can be verified two ways sets `verification` and `confidence` accordingly.

A wrong finding costs more credibility than a missed one. When in doubt, publish as `likely` (0.7) with the doubt stated, or not at all.

---

## 7. Design review automation (framework §3.8.1)

All 24 criteria run in-house, three methods:

**Method 1 — rendered-DOM signals (deterministic).** From the live page's computed styles: font families ranked by element count · colour palette ranked by frequency · uppercase-transform count · text-stroke count · slider/carousel roots · dead links (post-verification) · emoji in text · unique button labels per action · card/button class sprawl · section padding rhythm · WhatsApp links checked for a pre-filled `?text=` parameter.

**Method 2 — image review (Claude vision).** Download the key images (hero, largest content images, people shots), send to Claude against the five imagery criteria: is there a person · is it sharp or compressed · is text baked into the image · does it match its label · is it a placeholder/broken. This is what replaces the human designer's eye.

**Method 3 — filename forensics (deterministic).** `IMG-…-WA####` / `WhatsApp-Image-…` = WhatsApp-compressed · `images-17.jpg`, `download.png`, `Screenshot …` = generic/provisional · Unsplash/`ixlib` params = stock leftovers · staging hostnames (`*.netlify.app`, preview URLs) = fragile assets. Also: displayed size vs natural size (upscaled images), and brand-name spelling counted across body, logo alt, footer and `<title>`.

Criteria 9 (font personality matches brand) and 22 (visual weight matches importance) are honest judgments — LLM-assessed, labelled as judgment in `internal_detail`, half-credit convention applies. Screenshot every ⚠ / ❌ criterion (Playwright can; store the crop in `artifacts`) — clients believe screenshots.

---

## 8. Scoring engine

Implement framework §6–§7 exactly:

- Each category starts at 100. Deduct per finding: Critical −25 · High −15 · Medium −8 · Low −3. Floor 0. Up to +10 documented credit for genuinely strong implementations.
- Design & Brand = (criteria points ÷ 24) × 100, with ⚠ = 0.5.
- Overall = Σ(category × weight) using the 9-category weight table. If a category is genuinely N/A (e.g. Local for a pure academic site), redistribute its weight proportionally and record the redistribution in `scores`.
- Roll up to the 6 client-facing areas per framework §7 — weights preserved, so both documents show the same overall number. Bands: 0–34 Critical · 35–54 Developing · 55–69 Fair · 70–84 Good · 85–100 Excellent.

**Calibration reference** (not hard tests — sites change; use to sanity-check the engine on first runs):
BayarZakat 68 · KATMB 59 · MRL 56 · Takaful Solutions 54 · Cipta Karya 51 · ROROBIN 47 · Adam Karpets 46 · CQ-TEC 44 · DRVSAFE 36 · KAMA-AI 34 · Naz Indah Mall 34 · AD-DEEN 33 · TongRoroBin 29 · MY.Z 18.

---

## 9. Outputs & disclosure

| Output | Tiers | Audience |
|---|---|---|
| Visibility Score + dashboard | all | team |
| Client Visibility Check PDF | all | client (via the team) |
| Internal findings report | Investigation + | team |
| Priorities + 30/60/90 plan | Intelligence | team only — this is the proposal |

**Client PDF.** Port the existing pipeline: the print template in `/templates`, Playwright `page.pdf()` (A4, no header/footer), logo embedded, colophon "DISCOVA · powered by lean.X digital". Structure per the fourteen real reports: letterhead → title block → overall score + health scale → six area bars with one business-consequence sentence each → design sub-scores → "the clearest gap" comparison → 5–6 recommendations → "what this means" → colophon. 400–650 words. **Verify the page count == 2 before delivering** — the first manual render silently ran to 3 pages; never assume it fits.

**The writer layer (Claude).** Generates `client_summary` per finding and the PDF prose from `internal_detail` + evidence. Hard rule — the disclosure test from framework §8: *could a competent developer act on this sentence without us?* If yes, it stays internal. No named settings, plugins, code, page lists, keyword tables, or step-by-step fixes in anything client-facing. Enforced twice: the writer is instructed, and the PDF generator only reads `client_summary` fields.

**The clearest gap.** Every report carries one comparison chart holding the single most persuasive verified fact (pages-Google-can-find 1 vs 70 · photographs-of-people 4 vs 0 · sections-built 6 vs filled 0). The synthesis step selects it; the writer phrases it.

**Design standard.** Framework §16 governs the PDF *and* the app UI: type-led, serif + system sans, hairline rules, flat square-ended bars, one accent, no dashboard clichés, no emoji, minimal em-dashes in prose. The app should feel like an instrument, not a SaaS template.

---

## 10. External data policy

Labels are law: `verified` / `likely` / `requires_external_data` / `not_testable` — never fabricate, never estimate silently.

**Active in v1:** Claude API key (vision + writer) · PSI API key (free: Google Cloud project → enable "PageSpeed Insights API" → create API key; generous free daily quota — the manual audits hit the *anonymous* limit on day one, the key solves it).

**Deferred (render as requires_external_data until added):** Google Search Console OAuth (impressions, clicks, real queries — v2) · geo SERP API (Malaysian rank checking + competitor auto-discovery — DataForSEO or similar, paid) · backlink provider (paid).

**AI-visibility findings (never scored):** robots.txt directives for GPTBot / ClaudeBot / PerplexityBot etc. · llms.txt presence · schema and entity completeness · Organization/author markup · brand-name consistency. Reported as measurable signals that may contribute to machine understanding — never as a promise of AI-search presence.

---

## 11. Crawler conduct

- UA: `DiscovaBot/1.0 (+https://DOMAIN/bot)` — set DOMAIN when chosen; publish a one-line /bot page then.
- Respect robots.txt for our own fetching, while still reporting its contents as findings.
- Politeness: ≤2 concurrent requests per host · 500ms between requests · 15s timeout · Investigation hard cap 200 fetches.
- Template clustering: cluster URL paths by pattern (`/product/*`, `/blog/*`, `?id=` params), sample ≤5 per cluster. This is what makes site-wide analysis affordable and what powers template-attribution findings.
- Blocked or unrenderable sites (it happens — one of the fourteen was policy-blocked): produce a **partial** run with `not_testable` findings and an honest banner. Never crash, never guess.

---

## 12. Build order — frontend-first, stage by stage

Design → architecture → real data → integration → polish. The UI is built early against the real data model, fed by a fixture from a real audit — never by fake capability.

For every stage: explain what and why → implement → explain how to test → state what should happen → list keys/config needed. If something fails, diagnose it; do not propose a new architecture.

| Stage | Build | Test |
|---|---|---|
| 0 | Repos + Supabase project + deploy skeletons (Next.js "hello" on Vercel; worker heartbeat on Railway) | both URLs respond; worker writes a heartbeat row |
| 1 | Data model migrations + **fixture run**: the Takaful Solutions audit hand-encoded as runs/findings rows | tables populated; fixture queryable |
| 2 | Dashboard + run view: score, health scale, six area bars, findings list with evidence drawer — rendered from the fixture | screens match the report design standard |
| 3 | Client PDF generation from the fixture (port template, logo, page-count check) | output visually matches `templates/example-report.html`; /Count == 2 |
| 4 | Analyzer engine, Audit tier: fetch raw + rendered, run register checks, verification stage, scoring | run takafulsolutions.com; score lands ≈54; spot-check findings against the manual audit |
| 5 | Design module: DOM signals + filename forensics + Claude vision + screenshots-as-evidence | design score ≈19.5/24 on the same site |
| 6 | Writer layer: client_summary generation + disclosure filter | generated PDF prose passes the disclosure test on 3 known sites |
| 7 | pg-boss queue + live progress (status per module streamed to the run page) | start a run from the UI; watch modules complete |
| 8 | Investigation tier: site crawl, clustering, sampling, pattern findings | run on a ~100-page site; template-attribution findings appear |
| 9 | Intelligence tier: PSI key + CWV, competitor URLs comparison, priority model, 30/60/90 | competitor chart reproduces the 1-vs-70 shape; priorities ranked by the v2.2 formula |
| 10 | Supabase Auth (team-only), run history, partial-run handling, polish, custom domain | a teammate logs in and runs an audit unaided |

---

## 13. Deployment path

Local (`.env.local` with the §3 variables) → GitHub (one monorepo, two apps: `/web`, `/worker`) → Vercel imports `/web`, Railway imports `/worker`, both auto-deploy on push → custom domain attached to Vercel when chosen. Push code → deploy; no server management.

---

## 14. Non-goals for v1

No client logins · no auto competitor discovery · no rank tracking · no backlink metrics · no BM reports (structure the writer for it later) · no white-label · no microservices · no scored AI-visibility category · no metric that exists only to look impressive.

**Guiding principle: simple underneath, exceptional on top.**
