# DISCOVA · powered by lean.X digital

Website Visibility Intelligence. Enter a domain → queued, crawled, checked
against the lean.X audit framework, design-reviewed by vision, scored against
observed Google reality, written up in client-safe prose, delivered as a
2-page A4 Visibility Check PDF.

**App:** https://web-two-indol-41.vercel.app (custom domain: discova.site)
**Engine:** Railway (Singapore) · **Data:** Supabase Postgres

Repo map: `BUILD-PROMPT.md` (original build spec) · `SEO_AUDIT_FRAMEWORK.md`
(methodology v2.2) · `web/` (Next.js → Vercel) · `worker/` (engine → Railway)
· `supabase/migrations/` (schema, in order) · `templates/`, `assets/` (report
design sources).

## Architecture

```
Vercel (Next.js app)  ──WORKER_SECRET──►  Railway worker (Node + Playwright)
        │                                        │
        └────────────── Supabase Postgres ───────┘
                 (runs / findings / pages / heartbeat = the queue too)
```

- The **queue is the runs table**: the worker claims `queued` rows with
  `FOR UPDATE SKIP LOCKED`, one at a time. Crash mid-run → the row's
  heartbeat (`scores.beat`) goes stale and recovery re-queues it (max 2
  retries) at boot and every 2 minutes. Rolling deploys cannot double-process
  a run (fresh beat = leave it alone) and reprocessing wipes findings first.
- **One engine, tiers as depth**: Audit (~2 min) / Investigation (+ site-wide
  crawl, ~5 min) / Intelligence (+ PageSpeed, competitors, priorities,
  30/60/90, ~6 min). The score is identical at every tier (locked P3);
  deeper tiers add explanation, never a different number.

## The score (scale v0.13, 3 Sep 2026)

**Visibility Score = 60% site readiness + 40% observed Google presence.**

- *Readiness* = evidence-weighted framework score: category weight =
  framework weight × (checks assessed / register). No credit for unexamined
  ground. ~55 of the 160-check register assessed; grows over time.
- *Presence* = 40 pts indexing (own-domain `site:` results, floor-aware) +
  40 pts found for its own name (top 3 = 40, top 10 = 28) + 20 pts appearing
  for customer searches derived from the site's own wording.
- Every run carries: the formula, a **diagnosis** (deterministic cause:
  "Too new for Google" … "Genuinely visible"), the **funnel**
  (Crawlable → Indexable → Indexed → Found by name → Found for searches),
  and a GOOGLE TODAY evidence strip.
- **Scores from earlier engine versions are not comparable. Re-run before
  quoting.** Missing keys degrade honestly (pending notes), never punish.

## Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Railway | yes | Supabase session pooler |
| `ANTHROPIC_API_KEY` | Railway | yes | design vision + client-prose writer |
| `SERPER_API_KEY` | Railway | yes* | Google reality (index, name, searches, mentions). ~6 credits/audit; free tier ≈ 400 audits |
| `PSI_API_KEY` | Railway | optional | PageSpeed lab + CrUX field data (Intelligence) |
| `OPR_API_KEY` | Railway | optional | Open PageRank → scores the Authority category |
| `WORKER_SECRET` | Railway **and** Vercel (same value) | yes | locks every worker endpoint to the app |
| `WORKER_URL` | Vercel | yes | the Railway domain |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Vercel | yes | data access |
| `APP_PASSWORD` | Vercel | yes | the shared team login |

*without it runs still complete, scored as readiness-only with a note.

## Operations

- **Deploy**: push to `main` → Railway (worker/) and Vercel (web/) auto-deploy.
  `GET /health` shows version + which keys the process can see (booleans).
- **Endpoints** (all behind `x-worker-secret`): `POST /analyze?domain=&tier=`
  · `GET /run-scores?runId=` · `GET /pdf?runId=` ·
  `POST /admin/purge-runs?confirm=delete-everything` (wipes every run).
- **Local test modes** (worker/, no keys needed):
  `node index.js --analyze-test <domain> [--tier investigation]` (full pipeline,
  no DB) · `node index.js --pdf-test` (renders the enriched fixture, asserts
  the 2-page contract).
- **Geo notes**: engine runs in Singapore — Malaysian sites respond
  honestly; strictly-MY-geofenced sites (e.g. katmb.com.my) cannot be audited
  from any cloud and fail with a plain explanation.
- **Crawler etiquette**: max 2 concurrent, 500ms delay, 200-page cap, never
  follows cart-action URLs, strips tracking params. Search queries pace 600ms
  apart with one retry on rate-limit.

## The disclosure rule

Findings carry two wordings: `internal_detail` (developer-ready, internal
only) and `client_summary` (business consequence — the only wording the
client PDF may use). The writer's output is scanned for technical vocabulary
and rewritten if it leaks. The full fix list is the engagement we sell;
the report proves the problems, never hands over the mechanism.
