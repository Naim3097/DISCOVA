// DISCOVA worker — Stage 3: heartbeat + PDF endpoint.
// GET /health          → heartbeat status
// GET /pdf?runId=<id>  → the client Visibility Check PDF for that run
import http from "node:http";
import pg from "pg";
import { chromium } from "playwright";
import { buildReportHtml, countPdfPages } from "./report.js";

const VERSION = "0.2.2-stage3";
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
      res.writeHead(404); res.end("not found");
    } catch (e) {
      console.error("[discova-worker] request failed:", e.message);
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`error: ${e.message}`);
    }
  });
  server.listen(PORT, () => console.log(`[discova-worker] http listening on :${PORT}`));
}

async function main() {
  console.log(`[discova-worker] ${VERSION} starting`);
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
