// DISCOVA worker — Stage 3: heartbeat + PDF endpoint.
// GET /health          → heartbeat status
// GET /pdf?runId=<id>  → the client Visibility Check PDF for that run
import http from "node:http";
import pg from "pg";
import { chromium } from "playwright";
import { buildReportHtml, countPdfPages } from "./report.js";
import { runAudit } from "./analyze.js";

const VERSION = "0.4.0-stage5";
const once = process.argv.includes("--once");
const pdfTest = process.argv.includes("--pdf-test");
const url = process.env.DATABASE_URL;
const PORT = process.env.PORT || 3333;

let pool = null;
if (url) {
  pool = new pg.Pool({
    connectionString: url,
    ssl: /supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
}

async function beat() {
  if (!pool) {
    console.log(`[discova-worker] tick ${new Date().toISOString()} (local mode — no DATABASE_URL)`);
    return;
  }
  await pool.query(`
    create table if not exists worker_heartbeat (
      id int primary key, last_beat timestamptz not null, version text not null)`);
  await pool.query(
    `insert into worker_heartbeat (id, last_beat, version) values (1, now(), $1)
     on conflict (id) do update set last_beat = now(), version = $1`, [VERSION]);
  console.log(`[discova-worker] heartbeat written ${new Date().toISOString()}`);
}

async function fetchRun(runId) {
  const { rows: [run] } = await pool.query(`select * from runs where id = $1`, [runId]);
  if (!run) return null;
  const { rows: findings } = await pool.query(`select * from findings where run_id = $1`, [runId]);
  return { run, findings };
}

async function renderPdf(run, findings) {
  const html = buildReportHtml(run, findings);
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return pdf;
  } finally {
    await browser.close();
  }
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (u.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, version: VERSION, db: !!pool }));
        return;
      }
      if (u.pathname === "/pdf") {
        const secret = process.env.WORKER_SECRET;
        if (secret && req.headers["x-worker-secret"] !== secret) {
          res.writeHead(401); res.end("unauthorized"); return;
        }
        if (!pool) { res.writeHead(503); res.end("no database"); return; }
        const runId = u.searchParams.get("runId");
        if (!runId) { res.writeHead(400); res.end("runId required"); return; }
        const data = await fetchRun(runId);
        if (!data) { res.writeHead(404); res.end("run not found"); return; }
        const t0 = Date.now();
        const pdf = await renderPdf(data.run, data.findings);
        const pages = countPdfPages(pdf);
        console.log(`[discova-worker] pdf for ${data.run.domain}: ${pages} pages, ${pdf.length} bytes, ${Date.now() - t0}ms`);
        if (pages !== 2) console.warn(`[discova-worker] WARN page count ${pages} != 2 for ${data.run.domain}`);
        res.writeHead(200, {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename="${data.run.domain.replace(/[^a-z0-9.-]/gi, "_")}-Visibility-Check.pdf"`,
          "x-discova-pages": String(pages ?? "unknown"),
        });
        res.end(pdf);
        return;
      }
      if (u.pathname === "/analyze") {
        const secret = process.env.WORKER_SECRET;
        if (secret && req.headers["x-worker-secret"] !== secret) {
          res.writeHead(401); res.end("unauthorized"); return;
        }
        if (!pool) { res.writeHead(503); res.end("no database"); return; }
        const domain = (u.searchParams.get("domain") ?? "").trim().toLowerCase()
          .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
          res.writeHead(400); res.end("valid domain required"); return;
        }
        const { rows: [run] } = await pool.query(
          `insert into runs (domain, tier, framework_version, status)
           values ($1, 'audit', '2.2', 'queued') returning id`, [domain]);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: run.id }));
        processRun(run.id, domain).catch((e) =>
          console.error(`[discova-worker] run ${run.id} crashed:`, e.message));
        return;
      }
      res.writeHead(404); res.end("not found");
    } catch (e) {
      console.error("[discova-worker] request failed:", e.message);
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`error: ${e.message}`);
    }
  });
  server.listen(PORT, () => console.log(`[discova-worker] http listening on :${PORT}`));
}

async function processRun(runId, domain) {
  const setStatus = (st) => pool.query("update runs set status=$1 where id=$2", [st, runId]);
  const log = (m) => console.log(`[discova-worker] run ${runId.slice(0, 8)} ${domain}: ${m}`);
  try {
    const { scores, findings } = await runAudit(domain, { onStatus: setStatus, log });
    await setStatus("writing");
    for (const f of findings) {
      await pool.query(
        `insert into findings (run_id, check_id, category, severity, title, evidence,
           evidence_label, verification, confidence, reach, internal_detail, client_summary,
           effort, score_impact)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [runId, f.check_id, f.category, f.severity, f.title, f.evidence ?? null,
         f.evidence_label, f.verification ?? "none", f.confidence ?? 1.0, f.reach ?? null,
         f.internal_detail ?? null, f.client_summary ?? null, f.effort ?? null,
         f.score_impact ?? 0]);
    }
    await pool.query(
      "update runs set status='done', finished_at=now(), scores=$1 where id=$2",
      [JSON.stringify(scores), runId]);
    log(`done — ${scores.overall}/100 ${scores.band}, ${findings.length} findings`);
  } catch (e) {
    console.error(`[discova-worker] run ${runId} failed:`, e);
    await pool.query(
      "update runs set status='failed', finished_at=now(), scores=$1 where id=$2",
      [JSON.stringify({ error: e.message }), runId]).catch(() => {});
  }
}

async function main() {
  console.log(`[discova-worker] ${VERSION} starting`);
  const at = process.argv.indexOf("--analyze-test");
  if (at !== -1) {
    const domain = process.argv[at + 1];
    const { writeFileSync } = await import("node:fs");
    const { scores, findings } = await runAudit(domain, { onStatus: async () => {}, log: console.log });
    writeFileSync("analyze-test.json", JSON.stringify({ scores, findings }, null, 2));
    console.log(`
=== ${domain} — ${scores.overall}/100 ${scores.band}${scores.design_pending ? " (design pending)" : ` (design ${scores.design_total.points}/24)`} ===`);
    for (const a of scores.areas) console.log(`  ${a.label.padEnd(22)} ${String(a.score).padStart(3)}  ${a.status}`);
    console.log(`  findings: ${findings.length} → analyze-test.json`);
    for (const f of findings) console.log(`   [${f.severity[0]}] ${f.check_id}: ${f.title}`);
    return;
  }
  if (pdfTest) {
    const { readFileSync, writeFileSync } = await import("node:fs");
    const fx = JSON.parse(readFileSync(new URL("./test-fixture.json", import.meta.url)));
    const pdf = await renderPdf(fx.run, fx.findings);
    writeFileSync("test-report.pdf", pdf);
    console.log(`[discova-worker] pdf-test: ${countPdfPages(pdf)} pages, ${pdf.length} bytes → test-report.pdf`);
    return;
  }
  await beat();
  if (once) { if (pool) await pool.end(); return; }
  setInterval(() => beat().catch((e) => console.error("[discova-worker] beat failed:", e.message)), 30_000);
  startServer();
}

process.on("SIGTERM", () => process.exit(0));
main().catch((e) => { console.error("[discova-worker] fatal:", e.message); process.exit(1); });
